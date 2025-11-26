/**
 * @fileoverview Razorpay payment controller
 * @module controllers/razorpay
 */

import { razorpayInstance } from "../../utils/razorpay.util.js";
import Payment from "../../schema/Payment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * @typedef {Object} CreateOrderRequest
 * @property {string} [currency='INR'] - Payment currency (default: INR)
 * @property {string} type - Payment type: 'EVENT', 'SESSION', 'OTHER', 'PRODUCT' (required)
 * @property {string} eventId - MongoDB ObjectId of the event (required)
 * @property {string} [priceTierId] - MongoDB ObjectId of the pricing tier (optional, uses default pricing if not provided)
 * @property {string} [sessionId] - MongoDB ObjectId of the session (optional, for future use)
 * @property {Object} [metadata] - Additional metadata for the payment
 * @property {string} [metadata.callbackUrl] - Custom callback URL after payment completion
 * @property {Object} metadata.buyer - Buyer information (required)
 * @property {string} metadata.buyer.name - Buyer's name
 * @property {string} metadata.buyer.email - Buyer's email
 * @property {string} metadata.buyer.phone - Buyer's phone number (required for duplicate enrollment check)
 */

/**
 * @typedef {Object} CreateOrderResponse
 * @property {number} status - HTTP status code (201)
 * @property {string} message - Success message
 * @property {null} error - Error object (null on success)
 * @property {Object} data - Response data
 * @property {string} data.orderId - Razorpay order ID (e.g., "order_MhXXXXXXXXXX")
 * @property {number} data.amount - Payment amount in INR
 * @property {string} data.currency - Payment currency
 * @property {string} data.paymentUrl - Razorpay payment link short URL for redirect
 * @property {string} data.paymentLinkId - Razorpay payment link ID
 * @property {string} data.status - Order status (e.g., "created")
 * @property {number} data.createdAt - Unix timestamp of order creation
 * @property {Object} data.gateway - Gateway configuration
 * @property {string} data.gateway.name - Gateway name ("razorpay")
 * @property {string} data.gateway.keyId - Razorpay key ID for client-side integration
 */

/**
 * Create a payment order with Razorpay
 * Creates both a Razorpay order and payment link, stores payment record in database
 * Returns payment link URL that can be used to redirect user for payment
 *
 * Supports both single ticket purchase (buyer only) and multi-ticket purchase (buyer + others)
 *
 * @route POST /api/web/razorpay/create-order
 * @access Public
 *
 * @param {import('express').Request} req - Express request object
 * @param {CreateOrderRequest} req.body - Request body with payment details
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<CreateOrderResponse>} JSON response with order details and payment URL
 *
 * @throws {400} Bad Request - If type/eventId missing, invalid pricing tier, event not live, or booking period ended
 * @throws {404} Not Found - If event doesn't exist
 * @throws {500} Internal Server Error - If order creation fails
 *
 * @example
 * // Request - Single Ticket Purchase (Default Pricing)
 * POST /api/web/razorpay/create-order
 * {
 *   "currency": "INR",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "metadata": {
 *     "callbackUrl": "https://myapp.com/payment/success",
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     }
 *   }
 * }
 *
 * @example
 * // Request - Single Ticket Purchase (With Pricing Tier)
 * POST /api/web/razorpay/create-order
 * {
 *   "currency": "INR",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "priceTierId": "507f1f77bcf86cd799439099",
 *   "metadata": {
 *     "callbackUrl": "https://myapp.com/payment/success",
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     }
 *   }
 * }
 *
 * // Response (201 Created)
 * {
 *   "status": 201,
 *   "message": "Payment order created successfully",
 *   "error": null,
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "amount": 1500,
 *     "currency": "INR",
 *     "paymentUrl": "https://rzp.io/i/aBcDeFg",
 *     "paymentLinkId": "plink_MhXXXXXXXXXX",
 *     "status": "created",
 *     "createdAt": 1700000000,
 *     "gateway": {
 *       "name": "razorpay",
 *       "keyId": "rzp_live_RfiSt8Qm9shvHH"
 *     }
 *   }
 * }
 */
export const createOrder = async (req, res) => {
  try {
    const {
      currency = "INR",
      type,
      eventId,
      priceTierId,
      sessionId,
      metadata = {},
    } = req.body;

    // Validate required fields
    if (!type) {
      return responseUtil.badRequest(res, "Payment type is required");
    }

    if (!eventId) {
      return responseUtil.badRequest(res, "Event ID is required");
    }

    // Fetch event from database to get pricing
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Check if event is live and bookings are open
    if (!event.isLive) {
      return responseUtil.badRequest(res, "Event is not currently available for booking");
    }

    // Check if event has ended
    if (event.endDate <= new Date()) {
      return responseUtil.badRequest(res, "Event booking period has ended");
    }

    // === BUYER VALIDATION ===
    // Validate buyer information exists
    if (!metadata.buyer || !metadata.buyer.phone) {
      return responseUtil.badRequest(res, "Buyer information with phone number is required");
    }
    // === END BUYER VALIDATION ===

    // Determine price based on pricing tier or default pricing
    let amount;
    let compareAtPrice;
    let tierName = null;

    if (priceTierId) {
      // Use pricing tier
      const tier = event.pricingTiers?.find(
        (t) => t._id.toString() === priceTierId
      );

      if (!tier) {
        return responseUtil.badRequest(res, "Invalid pricing tier ID");
      }

      amount = tier.price;
      compareAtPrice = tier.compareAtPrice;
      tierName = tier.name;
    } else {
      // Use default pricing
      if (event.price == null) {
        return responseUtil.badRequest(
          res,
          "Event does not have default pricing. Please specify a pricing tier."
        );
      }

      amount = event.price;
      compareAtPrice = event.compareAtPrice;
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return responseUtil.badRequest(res, "Invalid event pricing");
    }

    // Calculate total tickets (buyer + others)
    const others = metadata.others || [];
    const totalTickets = 1 + others.length; // 1 for buyer + number of others

    // Calculate total amount (per ticket price * number of tickets)
    const totalAmount = amount * totalTickets;

    // Log purchase information
    console.log(`=== ${totalTickets === 1 ? 'Single' : 'Multi'} Ticket Purchase ===`);
    console.log("Buyer:", {
      name: metadata.buyer?.name || "N/A",
      email: metadata.buyer?.email || "N/A",
      phone: metadata.buyer?.phone || "N/A",
    });
    if (others.length > 0) {
      console.log("Additional Attendees:", others);
    }

    // Prepare notes with customer details
    const orderNotes = {
      type,
      eventId: eventId || "",
      sessionId: sessionId || "",
      eventName: event.name,
      totalTickets: totalTickets,
      ...(tierName && { tierName }),
    };

    // Add buyer details to notes
    if (metadata.buyer) {
      orderNotes.buyer_name = metadata.buyer.name || "";
      orderNotes.buyer_email = metadata.buyer.email || "";
      orderNotes.buyer_phone = metadata.buyer.phone || "";
    }

    // Create Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: currency,
      receipt: `order_${Date.now()}`,
      notes: orderNotes,
    });

    // Create payment record in database
    const payment = new Payment({
      orderId: razorpayOrder.id,
      type,
      eventId: eventId || null,
      sessionId: sessionId || null,
      amount: totalAmount,
      discountAmount: 0,
      finalAmount: totalAmount,
      status: "PENDING",
      metadata: {
        ...metadata,
        razorpayOrderStatus: razorpayOrder.status,
        // Store pricing information
        ...(priceTierId && { priceTierId, tierName }),
        ...(compareAtPrice && { compareAtPrice }),
        // Store ticket count
        totalTickets: totalTickets,
        perTicketPrice: amount,
      },
    });

    await payment.save();

    // Prepare payment link notes
    const paymentLinkNotes = {
      orderId: razorpayOrder.id,
      type,
      eventName: event.name,
      totalTickets: totalTickets,
      ...(tierName && { tierName }),
    };

    // Add buyer details to payment link notes
    if (metadata.buyer) {
      paymentLinkNotes.buyer_name = metadata.buyer.name || "";
      paymentLinkNotes.buyer_email = metadata.buyer.email || "";
      paymentLinkNotes.buyer_phone = metadata.buyer.phone || "";
    }

    // Create payment link for redirect
    const paymentLink = await razorpayInstance.paymentLink.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: currency,
      description: `Payment for ${event.name}${tierName ? ` - ${tierName}` : ""} (${totalTickets} ticket${totalTickets > 1 ? 's' : ''})`,
      reference_id: razorpayOrder.id,
      callback_url:
        metadata.callbackUrl ||
        `${
          process.env.WORDPRESS_FRONTEND_URL + "/payment-success" ||
          "https://mediumpurple-dotterel-484503.hostingersite.com" +
            "/payment-success"
        }`,
      callback_method: "get",
      customer: {
        name: metadata.buyer?.name || "",
        email: metadata.buyer?.email || "",
        contact: metadata.buyer?.phone || "",
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: paymentLinkNotes,
    });

    return responseUtil.created(res, "Payment order created successfully", {
      orderId: razorpayOrder.id,
      amount: totalAmount,
      perTicketPrice: amount,
      totalTickets: totalTickets,
      currency: currency,
      paymentUrl: paymentLink.short_url, // Redirect URL
      paymentLinkId: paymentLink.id,
      status: razorpayOrder.status,
      createdAt: razorpayOrder.created_at,
      gateway: {
        name: "razorpay",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    return responseUtil.internalError(
      res,
      "Failed to create payment order",
      error.message
    );
  }
};

/**
 * @typedef {Object} PaymentStatusResponse
 * @property {number} status - HTTP status code (200)
 * @property {string} message - Success message
 * @property {null} error - Error object (null on success)
 * @property {Object} data - Response data
 * @property {string} data.orderId - Razorpay order ID
 * @property {string|null} data.paymentId - Razorpay payment ID (null if not paid yet)
 * @property {string} data.status - Payment status: 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'
 * @property {number} data.amount - Final payment amount in INR
 * @property {string} data.type - Payment type: 'EVENT', 'SESSION', 'OTHER', 'PRODUCT'
 * @property {Date|null} data.purchaseDateTime - Date and time of successful payment
 * @property {string|null} data.failureReason - Reason for payment failure (if applicable)
 * @property {Object|null} data.event - Populated event details (if type is EVENT)
 * @property {string} [data.event.name] - Event name
 * @property {Date} [data.event.startDate] - Event start date
 * @property {Date} [data.event.endDate] - Event end date
 * @property {Object|null} data.session - Populated session details (if type is SESSION)
 * @property {string} [data.session.name] - Session name
 * @property {Date} [data.session.startDate] - Session start date
 * @property {Date} [data.session.endDate] - Session end date
 * @property {Date} data.createdAt - Payment record creation timestamp
 * @property {Date} data.updatedAt - Payment record last update timestamp
 */

/**
 * Get payment status by order ID
 * Retrieves payment status from database and optionally syncs with Razorpay if still pending
 * Supports long polling pattern for checking payment completion
 *
 * @route GET /api/web/razorpay/status/:orderId
 * @access Public
 *
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.orderId - Razorpay order ID to check status for (required)
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<PaymentStatusResponse>} JSON response with payment status details
 *
 * @throws {400} Bad Request - If order ID is missing
 * @throws {404} Not Found - If payment record doesn't exist or doesn't belong to user
 * @throws {500} Internal Server Error - If status retrieval fails
 *
 * @description
 * This endpoint is designed for long polling. Client can repeatedly call this endpoint
 * to check if payment status has changed from PENDING to SUCCESS/FAILED.
 * If payment is still PENDING, it will also check with Razorpay API for latest status.
 *
 * @example
 * // Request
 * GET /api/web/razorpay/status/order_MhXXXXXXXXXX
 *
 * // Response (200 OK) - Payment Successful
 * {
 *   "status": 200,
 *   "message": "Payment status retrieved",
 *   "error": null,
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "paymentId": "pay_MhYYYYYYYYYY",
 *     "status": "SUCCESS",
 *     "amount": 1500,
 *     "type": "EVENT",
 *     "purchaseDateTime": "2025-11-24T10:30:00.000Z",
 *     "failureReason": null,
 *     "event": {
 *       "name": "Tech Conference 2025",
 *       "startDate": "2025-12-01T09:00:00.000Z",
 *       "endDate": "2025-12-01T18:00:00.000Z"
 *     },
 *     "session": null,
 *     "createdAt": "2025-11-24T10:15:00.000Z",
 *     "updatedAt": "2025-11-24T10:30:00.000Z"
 *   }
 * }
 *
 * @example
 * // Response (200 OK) - Payment Pending
 * {
 *   "status": 200,
 *   "message": "Payment status retrieved",
 *   "error": null,
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "paymentId": null,
 *     "status": "PENDING",
 *     "amount": 1500,
 *     "type": "EVENT",
 *     "purchaseDateTime": null,
 *     "failureReason": null,
 *     "event": null,
 *     "session": null,
 *     "createdAt": "2025-11-24T10:15:00.000Z",
 *     "updatedAt": "2025-11-24T10:15:00.000Z"
 *   }
 * }
 *
 * @example
 * // Response (200 OK) - Payment Failed
 * {
 *   "status": 200,
 *   "message": "Payment status retrieved",
 *   "error": null,
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "paymentId": null,
 *     "status": "FAILED",
 *     "amount": 1500,
 *     "type": "EVENT",
 *     "purchaseDateTime": null,
 *     "failureReason": "BAD_REQUEST_ERROR: Payment link expired",
 *     "event": null,
 *     "session": null,
 *     "createdAt": "2025-11-24T10:15:00.000Z",
 *     "updatedAt": "2025-11-24T10:45:00.000Z"
 *   }
 * }
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return responseUtil.badRequest(res, "Order ID is required");
    }

    // Find payment in database
    const payment = await Payment.findOne({ orderId })
      .populate("eventId", "name startDate endDate")
      .populate("sessionId", "name startDate endDate");

    if (!payment) {
      return responseUtil.notFound(res, "Payment not found");
    }

    // If payment is still pending, check with Razorpay
    if (payment.status === "PENDING") {
      try {
        const razorpayOrder = await razorpayInstance.orders.fetch(orderId);

        // If order status changed, update our record
        if (razorpayOrder.status === "paid") {
          payment.status = "SUCCESS";
          payment.purchaseDateTime = new Date(razorpayOrder.created_at * 1000);
          await payment.save();
        }
      } catch (rzError) {
        console.error("Razorpay fetch error:", rzError);
        // Continue with database status if Razorpay fetch fails
      }
    }

    return responseUtil.success(res, "Payment status retrieved", {
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.finalAmount,
      type: payment.type,
      purchaseDateTime: payment.purchaseDateTime,
      failureReason: payment.failureReason,
      event: payment.eventId,
      session: payment.sessionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    console.error("Get payment status error:", error);
    return responseUtil.internalError(
      res,
      "Failed to retrieve payment status",
      error.message
    );
  }
};

export default {
  createOrder,
  getPaymentStatus,
};
