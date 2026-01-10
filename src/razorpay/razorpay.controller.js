/**
 * @fileoverview Razorpay payment controller
 * @module controllers/razorpay
 */

import { razorpayInstance } from "../../utils/razorpay.util.js";
import Payment from "../../schema/Payment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import Voucher from "../../schema/Voucher.Schema.js";
import responseUtil from "../../utils/response.util.js";
import { reserveSeats, releaseSeatReservation } from "../SeatArrangement/seatArrangement.controller.js";

/**
 * Normalize phone number by extracting last 10 digits
 * Matches the normalization logic in webhook for consistency
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number (last 10 digits)
 */
const normalizePhone = (phone) => {
  if (phone && phone.length > 10) {
    return phone.slice(-10);
  }
  return phone;
};

/**
 * Validate email format using regex
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format (10 digits, numeric only)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
const isValidPhone = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(normalizedPhone);
};

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
    // Debug logging to diagnose request issues
    console.log(`[DEBUG] createOrder called from origin: ${req.headers.origin}`);
    console.log(`[DEBUG] Content-Type: ${req.headers['content-type']}`);
    console.log(`[DEBUG] Request body:`, JSON.stringify(req.body, null, 2));

    const {
      currency = "INR",
      type,
      eventId,
      priceTierId,
      sessionId,
      code,
      metadata = {},
    } = req.body;

    // Validate required fields
    if (!type) {
      console.log(`[DEBUG] Validation failed: type is missing`);
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

    // === SEAT SELECTION VALIDATION ===
    // If event has seat arrangement, validate seat selection
    if (event.hasSeatArrangement) {
      console.log('[RAZORPAY:SEAT] Event has seat arrangement, validating selection', {
        eventId,
        hasSeatArrangement: event.hasSeatArrangement
      });

      const { selectedSeats } = metadata || {};

      if (!selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
        console.log('[RAZORPAY:SEAT] Validation FAILED - No seats selected', {
          eventId,
          selectedSeats: selectedSeats || 'undefined'
        });
        return responseUtil.badRequest(res, "Seat selection is required for this event");
      }

      console.log('[RAZORPAY:SEAT] Seats provided', {
        eventId,
        seatCount: selectedSeats.length,
        seats: selectedSeats.map(s => s.seatLabel || s)
      });
    }
    // === END SEAT SELECTION VALIDATION ===

    // === BUYER VALIDATION ===
    // Validate buyer information exists
    if (!metadata.buyer || !metadata.buyer.phone) {
      return responseUtil.badRequest(res, "Buyer information with phone number is required");
    }

    // Validate buyer name is non-empty
    if (!metadata.buyer.name || !metadata.buyer.name.trim()) {
      return responseUtil.badRequest(res, "Buyer name is required");
    }

    // Validate buyer phone format
    if (!isValidPhone(metadata.buyer.phone)) {
      return responseUtil.badRequest(res, "Invalid buyer phone number format. Must be 10 digits.");
    }

    // Validate buyer email format (if provided)
    if (metadata.buyer.email && !isValidEmail(metadata.buyer.email)) {
      return responseUtil.badRequest(res, "Invalid buyer email format");
    }

    // === OTHERS VALIDATION ===
    // Extract and validate others array before enrollment check
    const others = metadata.others || [];

    if (others.length > 0) {
      for (let i = 0; i < others.length; i++) {
        const other = others[i];

        // Validate name
        if (!other.name || !other.name.trim()) {
          return responseUtil.badRequest(res, `Ticket holder ${i + 1}: Name is required`);
        }

        // Validate phone
        if (!other.phone) {
          return responseUtil.badRequest(res, `Ticket holder ${i + 1}: Phone number is required`);
        }

        if (!isValidPhone(other.phone)) {
          return responseUtil.badRequest(res, `Ticket holder ${i + 1}: Invalid phone number format. Must be 10 digits.`);
        }

        // Validate email format (if provided)
        if (other.email && !isValidEmail(other.email)) {
          return responseUtil.badRequest(res, `Ticket holder ${i + 1}: Invalid email format`);
        }
      }
    }
    // === END OTHERS VALIDATION ===

    // === DUPLICATE PHONE CHECK WITHIN ORDER ===
    // Collect all phone numbers and check for duplicates within this order
    const normalizedBuyerPhone = normalizePhone(metadata.buyer.phone);
    const phoneSet = new Set();
    phoneSet.add(normalizedBuyerPhone);

    for (const other of others) {
      const normalizedPhone = normalizePhone(other.phone);

      if (phoneSet.has(normalizedPhone)) {
        return responseUtil.badRequest(res, `Duplicate phone number in order: ${other.phone}. Each ticket must have a unique phone number.`);
      }

      phoneSet.add(normalizedPhone);
    }
    // === END DUPLICATE PHONE CHECK ===

    // === DUPLICATE ENROLLMENT & TICKET CHECK ===
    // Collect ALL phone numbers from the order for enrollment check
    const allOrderPhones = Array.from(phoneSet); // Use the phoneSet we already created

    console.log(`[ENROLLMENT-CHECK] Checking ${allOrderPhones.length} phone number(s) for existing tickets:`, allOrderPhones);

    // Find ALL enrollments for this event that contain any of these phone numbers
    const existingEnrollments = await EventEnrollment.find({
      eventId: eventId
    });

    console.log(`[ENROLLMENT-CHECK] Found ${existingEnrollments.length} total enrollment(s) for event ${eventId}`);

    // Check if any phone already has a ticket in ANY enrollment
    const duplicatePhones = [];

    for (const enrollment of existingEnrollments) {
      const tickets = enrollment.tickets;

      for (const phone of allOrderPhones) {
        if (tickets.has(phone)) {
          console.error(`[ENROLLMENT-CHECK] Phone ${phone} already has ticket in enrollment ${enrollment._id}`);
          duplicatePhones.push(phone);
        }
      }
    }

    // Remove duplicates from duplicatePhones array (in case same phone found in multiple enrollments)
    const uniqueDuplicatePhones = [...new Set(duplicatePhones)];

    if (uniqueDuplicatePhones.length > 0) {
      console.error(`[ENROLLMENT-CHECK] Duplicate phone numbers found:`, uniqueDuplicatePhones);
      return responseUtil.badRequest(
        res,
        `Phone number(s) already have tickets for this event: ${uniqueDuplicatePhones.join(', ')}`
      );
    }

    console.log(`[ENROLLMENT-CHECK] No duplicate phones found - purchase allowed`);
    // === END DUPLICATE ENROLLMENT & TICKET CHECK ===
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
    // Note: 'others' array already validated above
    const totalTickets = 1 + others.length; // 1 for buyer + number of others

    // Validate seat count matches total tickets (for events with seat arrangement)
    if (event.hasSeatArrangement && metadata.selectedSeats) {
      if (metadata.selectedSeats.length !== totalTickets) {
        console.log('[RAZORPAY:SEAT] Validation FAILED - Seat count mismatch', {
          eventId,
          selectedSeatsCount: metadata.selectedSeats.length,
          expectedCount: totalTickets
        });
        return responseUtil.badRequest(res, `Must select ${totalTickets} seat(s)`);
      }
      console.log('[RAZORPAY:SEAT] Seat count validation PASSED', {
        eventId,
        selectedSeatsCount: metadata.selectedSeats.length,
        totalTickets
      });
    }

    // Use the tier price as the total amount (don't multiply by tickets)
    const totalAmount = amount;

    // === VOUCHER CLAIMING ===
    let claimedVoucher = null;
    let voucherClaimedPhones = []; // Track which phones actually got the voucher
    if (code) {
      console.log('[VOUCHER] Processing voucher code:', code);

      // Collect all phone numbers (buyer + others)
      const allPhones = [metadata.buyer.phone];
      for (const other of others) {
        if (other.phone) {
          allPhones.push(other.phone);
        }
      }

      // Normalize phone numbers
      const normalizedPhones = allPhones.map(p => p.slice(-10));

      // Find and validate voucher
      const voucher = await Voucher.findOne({ code: code.toUpperCase(), isActive: true });

      if (!voucher) {
        console.log('[VOUCHER] Invalid voucher code:', code);
        return responseUtil.badRequest(res, 'Invalid voucher code');
      }

      // Check if voucher is event-specific
      if (voucher.events && voucher.events.length > 0) {
        const isValidForEvent = voucher.events.some(e => e.toString() === eventId);
        if (!isValidForEvent) {
          console.log('[VOUCHER] Voucher not valid for this event:', code);
          return responseUtil.badRequest(res, 'This voucher is not valid for this event');
        }
      }

      // Filter out phones that have already claimed this voucher
      const eligiblePhones = normalizedPhones.filter(phone => !voucher.claimedPhones.includes(phone));

      if (eligiblePhones.length === 0) {
        console.log('[VOUCHER] All phones have already claimed this voucher');
        return responseUtil.badRequest(res, 'All phone numbers have already claimed this voucher');
      }

      // Check availability and determine how many phones can claim
      const availableSlots = voucher.maxUsage - voucher.claimedPhones.length;

      if (availableSlots <= 0) {
        console.log('[VOUCHER] No vouchers available');
        return responseUtil.badRequest(res, 'Unlucky, we ran out of vouchers!');
      }

      // Partial claiming: only claim for available slots
      const phonesToClaim = eligiblePhones.slice(0, availableSlots);
      const phonesLeftOut = eligiblePhones.slice(availableSlots);

      if (phonesLeftOut.length > 0) {
        console.log('[VOUCHER] Partial claiming - some phones left out:', {
          claiming: phonesToClaim,
          leftOut: phonesLeftOut
        });
      }

      // Atomically claim the voucher (add phones to claimedPhones)
      claimedVoucher = await Voucher.claimVoucher(voucher._id, phonesToClaim);

      if (!claimedVoucher) {
        console.log('[VOUCHER] Race condition - voucher ran out during claim');
        // Don't fail the order, just proceed without voucher
        console.log('[VOUCHER] Proceeding without voucher claim');
      } else {
        voucherClaimedPhones = phonesToClaim;
        console.log('[VOUCHER] Voucher claimed successfully:', {
          code: claimedVoucher.code,
          claimedPhones: phonesToClaim,
          leftOutPhones: phonesLeftOut
        });
      }
    }
    // === END VOUCHER CLAIMING ===

    // Calculate per-ticket price for metadata
    const perTicketPrice = totalAmount / totalTickets;

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
        perTicketPrice: perTicketPrice,
        // Store voucher information for webhook processing
        ...(claimedVoucher && {
          voucherId: claimedVoucher._id.toString(),
          voucherClaimedPhones: voucherClaimedPhones
        }),
      },
    });

    await payment.save();

    // Reserve seats if event has seat arrangement
    if (event.hasSeatArrangement && metadata.selectedSeats && Array.isArray(metadata.selectedSeats) && metadata.selectedSeats.length > 0) {
      console.log('[RAZORPAY:SEAT] Event has seat arrangement, starting reservation', {
        eventId,
        orderId: razorpayOrder.id,
        seatCount: metadata.selectedSeats.length,
        seats: metadata.selectedSeats.map(s => s.seatLabel || s)
      });

      try {
        const reservationStart = Date.now();
        await reserveSeats({
          eventId,
          selectedSeats: metadata.selectedSeats,
          orderId: razorpayOrder.id
        });
        const reservationDuration = Date.now() - reservationStart;

        console.log('[RAZORPAY:SEAT] Seat reservation SUCCESS', {
          orderId: razorpayOrder.id,
          eventId,
          reservedSeats: metadata.selectedSeats.map(s => s.seatLabel || s),
          durationMs: reservationDuration
        });
      } catch (seatError) {
        // Seat reservation failed - rollback payment and voucher claim
        console.error('[RAZORPAY:SEAT] Seat reservation FAILED', {
          orderId: razorpayOrder.id,
          eventId,
          error: seatError.message,
          requestedSeats: metadata.selectedSeats.map(s => s.seatLabel || s)
        });

        // Rollback payment record
        await Payment.deleteOne({ _id: payment._id });
        console.log('[RAZORPAY:SEAT] Payment record rolled back', {
          paymentId: payment._id,
          orderId: razorpayOrder.id
        });

        // Rollback voucher claim if any
        if (claimedVoucher && voucherClaimedPhones.length > 0) {
          try {
            await Voucher.findByIdAndUpdate(claimedVoucher._id, {
              $pull: { claimedPhones: { $in: voucherClaimedPhones } }
            });
            console.log('[RAZORPAY:SEAT] Voucher claim rolled back', {
              voucherId: claimedVoucher._id,
              phones: voucherClaimedPhones
            });
          } catch (voucherError) {
            console.error('[RAZORPAY:SEAT] Voucher rollback FAILED', {
              voucherId: claimedVoucher._id,
              error: voucherError.message
            });
          }
        }

        return responseUtil.badRequest(res, seatError.message || 'Selected seats are no longer available');
      }
    }

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
      options: {
        checkout: {
          prefill: {
            contact: metadata.buyer?.phone || "",
            email: metadata.buyer?.email || "",
            name: metadata.buyer?.name || "",
          },
          readonly: {
            contact: true,  // Makes phone field read-only (optional)
            email: true,    // Makes email field read-only (optional)
          },
        },
      },
    });

    return responseUtil.created(res, "Payment order created successfully", {
      orderId: razorpayOrder.id,
      amount: totalAmount,
      perTicketPrice: perTicketPrice,
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
      // Include voucher info if claimed
      ...(claimedVoucher && {
        voucher: {
          id: claimedVoucher._id,
          code: claimedVoucher.code,
          title: claimedVoucher.title,
          claimedPhones: voucherClaimedPhones,
        },
      }),
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
      .populate("eventId", "name startDate endDate bookingStartDate bookingEndDate")
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
