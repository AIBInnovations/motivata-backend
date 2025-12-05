/**
 * @fileoverview Session payment controller - separate payment flow for sessions
 * @module controllers/session/payment
 */

import { razorpayInstance } from "../../utils/razorpay.util.js";
import Payment from "../../schema/Payment.schema.js";
import Session from "../../schema/Session.schema.js";
import SessionBooking from "../../schema/SessionBooking.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Create a payment order for session booking
 * Validates that user hasn't already booked this session (1 user per session rule)
 *
 * @route POST /api/app/sessions/payment/create-order
 * @access User (authenticated)
 */
export const createSessionOrder = async (req, res) => {
  try {
    console.log("[SESSION-PAYMENT] createSessionOrder called");
    console.log("[SESSION-PAYMENT] User:", req.user?._id);
    console.log("[SESSION-PAYMENT] Body:", JSON.stringify(req.body, null, 2));

    const { sessionId, currency = "INR", callbackUrl, userNotes } = req.body;
    const userId = req.user._id;

    // Validate sessionId is provided
    if (!sessionId) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    // Fetch session from database
    const session = await Session.findById(sessionId);
    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    // Check if session is live
    if (!session.isLive) {
      return responseUtil.badRequest(res, "Session is not currently available for booking");
    }

    // Check if session is fully booked
    if (session.availableSlots != null && session.bookedSlots >= session.availableSlots) {
      return responseUtil.badRequest(res, "Session is fully booked");
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // === CRITICAL: 1 USER PER SESSION VALIDATION ===
    // Check if user has already booked this session (not cancelled)
    const existingBooking = await SessionBooking.findOne({
      userId,
      sessionId,
      status: { $nin: ["cancelled"] },
    });

    if (existingBooking) {
      console.log("[SESSION-PAYMENT] User already has a booking for this session:", existingBooking.bookingReference);
      return responseUtil.badRequest(
        res,
        "You have already booked this session. Each user can only book one slot per session."
      );
    }
    // === END VALIDATION ===

    // Get session price
    const amount = session.price;

    // If session is free, handle differently
    if (!amount || amount <= 0) {
      // Create booking directly for free sessions
      const booking = new SessionBooking({
        userId,
        sessionId,
        userEmail: user.email || "",
        userPhone: user.phone,
        paymentStatus: "free",
        amountPaid: 0,
        userNotes,
        status: "confirmed",
      });

      await booking.save();

      // Increment booked slots
      await session.bookSlot();

      console.log("[SESSION-PAYMENT] Free session booking created:", booking.bookingReference);

      return responseUtil.created(res, "Session booked successfully (free)", {
        bookingReference: booking.bookingReference,
        status: "confirmed",
        paymentStatus: "free",
        calendlyLink: session.calendlyLink,
      });
    }

    // Create pending booking record
    const booking = new SessionBooking({
      userId,
      sessionId,
      userEmail: user.email || "",
      userPhone: user.phone,
      paymentStatus: "pending",
      amountPaid: amount,
      userNotes,
      status: "pending",
    });

    await booking.save();

    console.log("[SESSION-PAYMENT] Pending booking created:", booking.bookingReference);

    // Prepare order notes
    const orderNotes = {
      type: "SESSION",
      sessionId: sessionId,
      sessionTitle: session.title,
      bookingReference: booking.bookingReference,
      userId: userId.toString(),
      buyer_name: user.name || "",
      buyer_email: user.email || "",
      buyer_phone: user.phone || "",
    };

    // Create Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `session_${booking.bookingReference}`,
      notes: orderNotes,
    });

    console.log("[SESSION-PAYMENT] Razorpay order created:", razorpayOrder.id);

    // Create payment record in database
    const payment = new Payment({
      orderId: razorpayOrder.id,
      type: "SESSION",
      sessionId: sessionId,
      amount: amount,
      discountAmount: 0,
      finalAmount: amount,
      status: "PENDING",
      metadata: {
        sessionTitle: session.title,
        bookingReference: booking.bookingReference,
        userId: userId.toString(),
        buyer: {
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
        },
        razorpayOrderStatus: razorpayOrder.status,
      },
    });

    await payment.save();

    // Update booking with payment reference
    booking.paymentId = payment._id;
    await booking.save();

    // Create payment link for redirect
    const paymentLink = await razorpayInstance.paymentLink.create({
      amount: Math.round(amount * 100),
      currency: currency,
      description: `Session Booking: ${session.title}`,
      reference_id: razorpayOrder.id,
      callback_url:
        callbackUrl ||
        `${process.env.APP_FRONTEND_URL || process.env.WORDPRESS_FRONTEND_URL || "https://app.motivata.in"}/session-payment-success`,
      callback_method: "get",
      customer: {
        name: user.name || "",
        email: user.email || "",
        contact: user.phone || "",
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: orderNotes,
      options: {
        checkout: {
          prefill: {
            contact: user.phone || "",
            email: user.email || "",
            name: user.name || "",
          },
          readonly: {
            contact: true,
            email: true,
          },
        },
      },
    });

    console.log("[SESSION-PAYMENT] Payment link created:", paymentLink.short_url);

    return responseUtil.created(res, "Session payment order created successfully", {
      orderId: razorpayOrder.id,
      bookingReference: booking.bookingReference,
      amount: amount,
      currency: currency,
      paymentUrl: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      status: razorpayOrder.status,
      createdAt: razorpayOrder.created_at,
      session: {
        id: session._id,
        title: session.title,
        host: session.host,
        duration: session.duration,
        sessionType: session.sessionType,
      },
      gateway: {
        name: "razorpay",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("[SESSION-PAYMENT] Create order error:", error);
    return responseUtil.internalError(res, "Failed to create session payment order", error.message);
  }
};

/**
 * Get session payment status
 *
 * @route GET /api/app/sessions/payment/status/:orderId
 * @access Public
 */
export const getSessionPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return responseUtil.badRequest(res, "Order ID is required");
    }

    // Find payment in database
    const payment = await Payment.findOne({ orderId, type: "SESSION" }).populate(
      "sessionId",
      "title host duration sessionType calendlyLink"
    );

    if (!payment) {
      return responseUtil.notFound(res, "Session payment not found");
    }

    // Find associated booking
    const booking = await SessionBooking.findOne({
      bookingReference: payment.metadata?.bookingReference,
    });

    // If payment is still pending, check with Razorpay
    if (payment.status === "PENDING") {
      try {
        const razorpayOrder = await razorpayInstance.orders.fetch(orderId);

        if (razorpayOrder.status === "paid") {
          payment.status = "SUCCESS";
          payment.purchaseDateTime = new Date(razorpayOrder.created_at * 1000);
          await payment.save();
        }
      } catch (rzError) {
        console.error("[SESSION-PAYMENT] Razorpay fetch error:", rzError);
      }
    }

    return responseUtil.success(res, "Session payment status retrieved", {
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.finalAmount,
      purchaseDateTime: payment.purchaseDateTime,
      failureReason: payment.failureReason,
      session: payment.sessionId,
      booking: booking
        ? {
            bookingReference: booking.bookingReference,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
          }
        : null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    console.error("[SESSION-PAYMENT] Get status error:", error);
    return responseUtil.internalError(res, "Failed to retrieve session payment status", error.message);
  }
};

export default {
  createSessionOrder,
  getSessionPaymentStatus,
};
