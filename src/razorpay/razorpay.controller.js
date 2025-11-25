/**
 * @fileoverview Razorpay payment controller
 * @module controllers/razorpay
 */

import { razorpayInstance } from "../../utils/razorpay.util.js";
import Payment from "../../schema/Payment.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * @typedef {Object} CreateOrderRequest
 * @property {number} amount - Payment amount in INR (required, must be > 0)
 * @property {string} [currency='INR'] - Payment currency (default: INR)
 * @property {string} type - Payment type: 'EVENT', 'SESSION', 'OTHER', 'PRODUCT' (required)
 * @property {string} [eventId] - MongoDB ObjectId of the event (required if type is EVENT)
 * @property {string} [sessionId] - MongoDB ObjectId of the session (required if type is SESSION)
 * @property {Object} [metadata] - Additional metadata for the payment
 * @property {string} [metadata.callbackUrl] - Custom callback URL after payment completion
 * @property {string} [metadata.customerName] - Customer name for payment link (single purchase)
 * @property {string} [metadata.customerEmail] - Customer email for payment link (single purchase)
 * @property {string} [metadata.customerPhone] - Customer phone for payment link (single purchase)
 * @property {Array<Object>} [metadata.customers] - Array of customers for club/combo purchases
 * @property {string} [metadata.customers[].name] - Customer name
 * @property {string} [metadata.customers[].email] - Customer email
 * @property {string} [metadata.customers[].phone] - Customer phone
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
 * @route POST /api/web/razorpay/create-order
 * @access Public
 *
 * @param {import('express').Request} req - Express request object
 * @param {CreateOrderRequest} req.body - Request body with payment details
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<CreateOrderResponse>} JSON response with order details and payment URL
 *
 * @throws {400} Bad Request - If amount is invalid or type is missing
 * @throws {500} Internal Server Error - If order creation fails
 *
 * @example
 * // Request - Single Purchase
 * POST /api/web/razorpay/create-order
 * {
 *   "amount": 1500,
 *   "currency": "INR",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "metadata": {
 *     "callbackUrl": "https://myapp.com/payment/success",
 *     "customerName": "John Doe",
 *     "customerEmail": "john@example.com",
 *     "customerPhone": "+919876543210"
 *   }
 * }
 *
 * @example
 * // Request - Club/Combo Purchase (Multiple Customers)
 * POST /api/web/razorpay/create-order
 * {
 *   "amount": 4500,
 *   "currency": "INR",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "metadata": {
 *     "callbackUrl": "https://myapp.com/payment/success",
 *     "customers": [
 *       {
 *         "name": "John Doe",
 *         "email": "john@example.com",
 *         "phone": "+919876543210"
 *       },
 *       {
 *         "name": "Jane Smith",
 *         "email": "jane@example.com",
 *         "phone": "+919876543211"
 *       },
 *       {
 *         "name": "Bob Johnson",
 *         "email": "bob@example.com",
 *         "phone": "+919876543212"
 *       }
 *     ]
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
      amount,
      currency = "INR",
      type,
      eventId,
      sessionId,
      metadata = {},
    } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return responseUtil.badRequest(res, "Valid amount is required");
    }

    if (!type) {
      return responseUtil.badRequest(res, "Payment type is required");
    }

    // Prepare customer details for club/combo purchases
    const customers = metadata.customers || [];
    const isMultiCustomer = customers.length > 0;

    // Log customer information
    if (isMultiCustomer) {
      console.log("=== Club/Combo Purchase - Multiple Customers ===");
      console.log(`Number of customers: ${customers.length}`);
      customers.forEach((customer, index) => {
        console.log(`Customer ${index + 1}:`, {
          name: customer.name || "N/A",
          email: customer.email || "N/A",
          phone: customer.phone || "N/A",
        });
      });
    }

    // Prepare notes with customer details
    const orderNotes = {
      type,
      eventId: eventId || "",
      sessionId: sessionId || "",
    };

    // Add customer details to notes
    if (isMultiCustomer) {
      orderNotes.customerCount = customers.length;
      customers.forEach((customer, index) => {
        orderNotes[`customer_${index + 1}_name`] = customer.name || "";
        orderNotes[`customer_${index + 1}_email`] = customer.email || "";
        orderNotes[`customer_${index + 1}_phone`] = customer.phone || "";
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
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
      amount: amount,
      discountAmount: 0,
      finalAmount: amount,
      status: "PENDING",
      metadata: {
        ...metadata,
        razorpayOrderStatus: razorpayOrder.status,
        // Store customer details in payment metadata
        ...(isMultiCustomer && { customers }),
      },
    });

    await payment.save();

    // Prepare payment link notes
    const paymentLinkNotes = {
      orderId: razorpayOrder.id,
      type,
    };

    // Add customer details to payment link notes
    if (isMultiCustomer) {
      paymentLinkNotes.customerCount = customers.length;
      customers.forEach((customer, index) => {
        paymentLinkNotes[`customer_${index + 1}_name`] = customer.name || "";
        paymentLinkNotes[`customer_${index + 1}_email`] = customer.email || "";
        paymentLinkNotes[`customer_${index + 1}_phone`] = customer.phone || "";
      });
    }

    // Create payment link for redirect
    const paymentLink = await razorpayInstance.paymentLink.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      description: `Payment for ${type}${
        isMultiCustomer ? ` (${customers.length} customers)` : ""
      }`,
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
        name:
          metadata.customerName ||
          (isMultiCustomer ? customers[0]?.name : "") ||
          "",
        email:
          metadata.customerEmail ||
          (isMultiCustomer ? customers[0]?.email : "") ||
          "",
        contact:
          metadata.customerPhone ||
          (isMultiCustomer ? customers[0]?.phone : "") ||
          "",
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
      amount: amount,
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
