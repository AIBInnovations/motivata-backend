/**
 * @fileoverview Razorpay webhook handler
 * Processes Razorpay webhook events and updates payment records accordingly
 * @module webhooks/razorpay
 */

import { verifyWebhookSignature } from '../../utils/razorpay.util.js';
import Payment from '../../schema/Payment.schema.js';
import Coupon from '../../schema/Coupon.schema.js';
import Voucher from '../../schema/Voucher.Schema.js';
import User from '../../schema/User.schema.js';
import Event from '../../schema/Event.schema.js';
import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import Session from '../../schema/Session.schema.js';
import SessionBooking from '../../schema/SessionBooking.schema.js';
import bcrypt from 'bcryptjs';
import responseUtil from '../../utils/response.util.js';
import { sendBulkEmails } from '../../utils/email.util.js';
import {
  generateEnrollmentEmail,
  generateEnrollmentEmailText,
  generateTicketEmail,
  generateTicketEmailText
} from '../../utils/emailTemplate.util.js';
import {
  generateTicketQRCode,
  generateQRFilename,
  uploadQRCodeToCloudinary,
  generateVoucherQRCode,
  uploadVoucherQRCodeToCloudinary
} from '../../utils/qrcode.util.js';
import { sendBulkTicketWhatsApp, sendBulkVoucherWhatsApp } from '../../utils/whatsapp.util.js';

/**
 * @typedef {Object} RazorpayWebhookPayload
 * @property {string} event - Event type (e.g., 'payment.captured', 'order.paid')
 * @property {Object} payload - Event payload containing entity details
 * @property {Object} [payload.payment] - Payment entity (for payment.* events)
 * @property {Object} [payload.payment.entity] - Payment entity details
 * @property {Object} [payload.order] - Order entity (for order.* events)
 * @property {Object} [payload.order.entity] - Order entity details
 * @property {Object} [payload.payment_link] - Payment link entity (for payment_link.* events)
 * @property {Object} [payload.payment_link.entity] - Payment link entity details
 * @property {Object} [payload.refund] - Refund entity (for refund.* events)
 * @property {Object} [payload.refund.entity] - Refund entity details
 */

/**
 * @typedef {Object} WebhookResponse
 * @property {number} status - HTTP status code (200)
 * @property {string} message - Success message
 * @property {null} error - Error object (null on success)
 * @property {Object} data - Response data (empty object)
 */

/**
 * Handle Razorpay webhook events
 * Verifies webhook signature and processes different event types
 * Logs all webhook activity for debugging and audit purposes
 *
 * @route POST /api/web/razorpay/webhook
 * @access Public (signature verified)
 *
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers['x-razorpay-signature'] - Razorpay webhook signature (required)
 * @param {RazorpayWebhookPayload} req.body - Webhook payload from Razorpay
 *
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<WebhookResponse>} JSON response confirming webhook processing
 *
 * @throws {401} Unauthorized - If webhook signature is invalid
 * @throws {500} Internal Server Error - If webhook processing fails
 *
 * @description
 * This endpoint handles the following Razorpay webhook events:
 * - payment.captured: Payment successfully captured, updates payment to SUCCESS
 * - payment.failed: Payment failed, marks payment as FAILED with reason
 * - order.paid: Order payment completed, updates payment to SUCCESS
 * - payment_link.paid: Payment link completed successfully
 * - payment_link.cancelled: User cancelled payment link
 * - payment_link.expired: Payment link expired without payment
 * - refund.created: Refund initiated
 * - refund.processed: Refund completed, updates payment to REFUNDED
 *
 * All events are logged with detailed information to console for debugging.
 * Automatically updates related entities (coupons, event seats) on success/refund.
 *
 * @example
 * // Webhook Configuration in Razorpay Dashboard
 * // URL: https://yourdomain.com/api/web/razorpay/webhook
 * // Secret: Your RAZORPAY_KEY_SECRET
 * // Events: All events or specific events as needed
 *
 * @example
 * // Incoming Webhook - payment.captured event
 * POST /api/web/razorpay/webhook
 * Headers: {
 *   "x-razorpay-signature": "abc123def456..."
 * }
 * Body: {
 *   "event": "payment.captured",
 *   "payload": {
 *     "payment": {
 *       "entity": {
 *         "id": "pay_MhYYYYYYYYYY",
 *         "order_id": "order_MhXXXXXXXXXX",
 *         "amount": 150000,
 *         "currency": "INR",
 *         "status": "captured",
 *         "method": "card",
 *         ...
 *       }
 *     }
 *   }
 * }
 *
 * // Response (200 OK)
 * {
 *   "status": 200,
 *   "message": "Webhook processed successfully",
 *   "error": null,
 *   "data": {}
 * }
 *
 * // Console Log Output:
 * // === Razorpay Webhook Received ===
 * // Timestamp: 2025-11-24T10:30:00.000Z
 * // Event: payment.captured
 * // Payload: { ... }
 * // Signature: abc123def456...
 * // ✓ Webhook signature verified
 * // Processing payment.captured event
 * // ✓ Payment updated: pay_MhYYYYYYYYYY for order: order_MhXXXXXXXXXX
 * // ✓ Event seats decremented for event: 507f1f77bcf86cd799439011
 * // === Webhook Processing Complete ===
 */
export const handleWebhook = async (req, res) => {
  try {
    console.log('=== Razorpay Webhook Received ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body type:', req.body ? (Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body) : 'undefined');
    console.log('Body length:', req.body ? req.body.length : 0);

    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      console.error('❌ No signature header found in request');
      return responseUtil.unauthorized(res, 'Missing signature');
    }

    // Get raw body (Buffer) for signature verification
    const rawBody = req.body;

    if (!rawBody) {
      console.error('❌ No body found in request');
      return responseUtil.badRequest(res, 'Missing body');
    }

    // Parse the body to JSON for processing
    const payload = JSON.parse(rawBody.toString());

    // Log incoming webhook
    console.log('Event:', payload.event);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Signature:', signature);

    // Verify webhook signature using raw body
    const isValid = verifyWebhookSignature(signature, rawBody);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return responseUtil.unauthorized(res, 'Invalid signature');
    }

    console.log('✓ Webhook signature verified');

    // Handle different event types
    const { event, payload: eventPayload } = payload;

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(eventPayload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(eventPayload.payment.entity);
        break;

      case 'order.paid':
        await handleOrderPaid(eventPayload.order.entity);
        break;

      case 'payment_link.paid':
        await handlePaymentLinkPaid(eventPayload.payment_link.entity);
        break;

      case 'payment_link.cancelled':
        await handlePaymentLinkCancelled(eventPayload.payment_link.entity);
        break;

      case 'payment_link.expired':
        await handlePaymentLinkExpired(eventPayload.payment_link.entity);
        break;

      case 'refund.created':
        await handleRefundCreated(eventPayload.refund.entity);
        break;

      case 'refund.processed':
        await handleRefundProcessed(eventPayload.refund.entity);
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    console.log('=== Webhook Processing Complete ===\n');

    return responseUtil.success(res, 'Webhook processed successfully');
  } catch (error) {
    console.error('Webhook processing error:', error);
    return responseUtil.internalError(res, 'Failed to process webhook', error.message);
  }
};

/**
 * Handle payment.captured event
 * Updates payment record to SUCCESS status and updates related entities
 *
 * @param {Object} paymentEntity - Razorpay payment entity
 * @param {string} paymentEntity.id - Razorpay payment ID
 * @param {string} paymentEntity.order_id - Razorpay order ID
 * @param {number} paymentEntity.amount - Payment amount in paise
 * @param {string} paymentEntity.currency - Payment currency
 * @param {string} paymentEntity.status - Payment status
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentCaptured = async (paymentEntity) => {
  console.log('Processing payment.captured event');

  const { id: paymentId, order_id: orderId } = paymentEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  if (payment.status === 'SUCCESS') {
    console.log('Payment already marked as successful');
    return;
  }

  // Update payment record
  payment.paymentId = paymentId;
  payment.status = 'SUCCESS';
  payment.purchaseDateTime = new Date();
  payment.metadata = {
    ...payment.metadata,
    razorpayPaymentEntity: paymentEntity
  };
  await payment.save();

  console.log(`✓ Payment updated: ${paymentId} for order: ${orderId}`);

  // Update related entities
  await updateRelatedEntities(payment);
};

/**
 * Handle payment.failed event
 * Updates payment record to FAILED status with error details
 *
 * @param {Object} paymentEntity - Razorpay payment entity
 * @param {string} paymentEntity.order_id - Razorpay order ID
 * @param {string} paymentEntity.error_code - Error code from Razorpay
 * @param {string} paymentEntity.error_description - Error description
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentFailed = async (paymentEntity) => {
  console.log('Processing payment.failed event');

  const { order_id: orderId, error_code, error_description } = paymentEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  payment.status = 'FAILED';
  payment.failureReason = `${error_code}: ${error_description}`;
  payment.metadata = {
    ...payment.metadata,
    razorpayPaymentEntity: paymentEntity
  };
  await payment.save();

  console.log(`✓ Payment marked as failed for order: ${orderId}`);

  // Handle type-specific failure actions (session booking cancellation, etc.)
  if (payment.type === 'SESSION') {
    await cancelSessionBooking(payment);
  }

  // Release voucher claim if voucher was used (for EVENT type)
  await releaseVoucherClaim(payment);
};

/**
 * Handle order.paid event
 * Updates payment record to SUCCESS status when order is marked as paid
 *
 * @param {Object} orderEntity - Razorpay order entity
 * @param {string} orderEntity.id - Razorpay order ID
 *
 * @returns {Promise<void>}
 * @private
 */
const handleOrderPaid = async (orderEntity) => {
  console.log('Processing order.paid event');

  const { id: orderId } = orderEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  if (payment.status === 'SUCCESS') {
    console.log('Payment already marked as successful');
    return;
  }

  payment.status = 'SUCCESS';
  payment.purchaseDateTime = new Date();
  payment.metadata = {
    ...payment.metadata,
    razorpayOrderEntity: orderEntity
  };
  await payment.save();

  console.log(`✓ Order marked as paid: ${orderId}`);

  // Update related entities
  await updateRelatedEntities(payment);
};

/**
 * Handle payment_link.paid event
 * Updates payment record to SUCCESS status when payment link is completed
 *
 * @param {Object} paymentLinkEntity - Razorpay payment link entity
 * @param {string} paymentLinkEntity.reference_id - Reference ID (orderId)
 * @param {string} paymentLinkEntity.order_id - Razorpay order ID for the payment link
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentLinkPaid = async (paymentLinkEntity) => {
  console.log('Processing payment_link.paid event');

  const { reference_id: orderId, order_id: razorpayOrderId } = paymentLinkEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  if (payment.status === 'SUCCESS') {
    console.log('Payment already marked as successful');
    return;
  }

  // Fetch the Razorpay order to get payment details
  try {
    const { razorpayInstance } = await import('../../utils/razorpay.util.js');
    const razorpayOrder = await razorpayInstance.orders.fetch(razorpayOrderId);

    console.log('✓ Fetched Razorpay order:', razorpayOrderId);

    // Get payment ID from order payments
    let paymentId = null;
    if (razorpayOrder.payments && razorpayOrder.payments.length > 0) {
      // Get the first (or latest) payment ID
      paymentId = razorpayOrder.payments[0].id;
      console.log('✓ Extracted payment ID:', paymentId);

      // Optionally fetch full payment details
      try {
        const paymentEntity = await razorpayInstance.payments.fetch(paymentId);
        payment.metadata = {
          ...payment.metadata,
          razorpayPaymentLinkEntity: paymentLinkEntity,
          razorpayPaymentEntity: paymentEntity
        };
        console.log('✓ Fetched and stored payment entity');
      } catch (paymentFetchError) {
        console.warn('Could not fetch payment entity:', paymentFetchError.message);
        payment.metadata = {
          ...payment.metadata,
          razorpayPaymentLinkEntity: paymentLinkEntity
        };
      }
    } else {
      console.warn('No payments found in order, storing payment link entity only');
      payment.metadata = {
        ...payment.metadata,
        razorpayPaymentLinkEntity: paymentLinkEntity
      };
    }

    payment.paymentId = paymentId;
  } catch (fetchError) {
    console.error('Error fetching Razorpay order details:', fetchError.message);
    // Continue with payment link entity only
    payment.metadata = {
      ...payment.metadata,
      razorpayPaymentLinkEntity: paymentLinkEntity
    };
  }

  payment.status = 'SUCCESS';
  payment.purchaseDateTime = new Date();
  await payment.save();

  console.log(`✓ Payment link paid for order: ${orderId}`);

  // Update related entities
  await updateRelatedEntities(payment);
};

/**
 * Handle payment_link.cancelled event
 * Updates payment record to FAILED status when user cancels payment link
 *
 * @param {Object} paymentLinkEntity - Razorpay payment link entity
 * @param {string} paymentLinkEntity.reference_id - Reference ID (orderId)
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentLinkCancelled = async (paymentLinkEntity) => {
  console.log('Processing payment_link.cancelled event');

  const { reference_id: orderId } = paymentLinkEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  payment.status = 'FAILED';
  payment.failureReason = 'Payment link cancelled by user';
  await payment.save();

  console.log(`✓ Payment link cancelled for order: ${orderId}`);

  // Handle type-specific failure actions (session booking cancellation, etc.)
  if (payment.type === 'SESSION') {
    await cancelSessionBooking(payment);
  }

  // Release voucher claim if voucher was used (for EVENT type)
  await releaseVoucherClaim(payment);
};

/**
 * Handle payment_link.expired event
 * Updates payment record to FAILED status when payment link expires
 *
 * @param {Object} paymentLinkEntity - Razorpay payment link entity
 * @param {string} paymentLinkEntity.reference_id - Reference ID (orderId)
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentLinkExpired = async (paymentLinkEntity) => {
  console.log('Processing payment_link.expired event');

  const { reference_id: orderId } = paymentLinkEntity;

  const payment = await Payment.findOne({ orderId });

  if (!payment) {
    console.error(`Payment not found for order: ${orderId}`);
    return;
  }

  payment.status = 'FAILED';
  payment.failureReason = 'Payment link expired';
  await payment.save();

  console.log(`✓ Payment link expired for order: ${orderId}`);

  // Handle type-specific failure actions (session booking cancellation, etc.)
  if (payment.type === 'SESSION') {
    await cancelSessionBooking(payment);
  }

  // Release voucher claim if voucher was used (for EVENT type)
  await releaseVoucherClaim(payment);
};

/**
 * Handle refund.created event
 * Records refund initiation in payment metadata
 *
 * @param {Object} refundEntity - Razorpay refund entity
 * @param {string} refundEntity.payment_id - Razorpay payment ID
 *
 * @returns {Promise<void>}
 * @private
 */
const handleRefundCreated = async (refundEntity) => {
  console.log('Processing refund.created event');

  const { payment_id: paymentId } = refundEntity;

  const payment = await Payment.findOne({ paymentId });

  if (!payment) {
    console.error(`Payment not found for paymentId: ${paymentId}`);
    return;
  }

  payment.metadata = {
    ...payment.metadata,
    refund: refundEntity
  };
  await payment.save();

  console.log(`✓ Refund created for payment: ${paymentId}`);
};

/**
 * Handle refund.processed event
 * Updates payment record to REFUNDED status and reverses related entity changes
 *
 * @param {Object} refundEntity - Razorpay refund entity
 * @param {string} refundEntity.payment_id - Razorpay payment ID
 *
 * @returns {Promise<void>}
 * @private
 */
const handleRefundProcessed = async (refundEntity) => {
  console.log('Processing refund.processed event');

  const { payment_id: paymentId } = refundEntity;

  const payment = await Payment.findOne({ paymentId });

  if (!payment) {
    console.error(`Payment not found for paymentId: ${paymentId}`);
    return;
  }

  payment.status = 'REFUNDED';
  payment.metadata = {
    ...payment.metadata,
    refund: refundEntity
  };
  await payment.save();

  console.log(`✓ Refund processed for payment: ${paymentId}`);

  // Reverse related entity updates
  await reverseRelatedEntities(payment);
};

/**
 * Find or create user by phone number
 * If user doesn't exist, creates a new user with the provided details
 * Email is optional - users can be created with just phone number
 *
 * @param {Object} userData - User data
 * @param {string} userData.name - User's name
 * @param {string} [userData.email] - User's email (optional)
 * @param {string} userData.phone - User's phone number
 *
 * @returns {Promise<Object>} User document
 * @private
 */
const findOrCreateUser = async (userData) => {
  const { name, email } = userData;

  // Normalize phone number - extract last 10 digits if country code is present
  let phone = userData.phone;
  if (phone && phone.length > 10) {
    phone = phone.slice(-10);
    console.log(`[USER-CREATION] Phone normalized from ${userData.phone} to ${phone}`);
  }

  console.log(`[USER-CREATION] Checking if user exists with phone: ${phone}`);

  // Try to find user by phone number
  let user = await User.findOne({ phone, isDeleted: false });

  if (user) {
    console.log(`[USER-CREATION] User found with phone ${phone}:`, {
      userId: user._id,
      name: user.name,
      email: user.email || '(no email)'
    });
    return user;
  }

  // User doesn't exist, create new user
  console.log(`[USER-CREATION] User not found with phone ${phone}, creating new user`);

  try {
    // Use phone number as password for new users (consistent with cash flow)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(phone, salt);

    // Create user data - email is optional
    const newUserData = {
      name,
      phone,
      password: hashedPassword
    };

    // Only add email if provided and not empty
    if (email && email.trim()) {
      newUserData.email = email.trim().toLowerCase();
    }

    user = new User(newUserData);

    await user.save();

    console.log(`[USER-CREATION] New user created successfully:`, {
      userId: user._id,
      name: user.name,
      email: user.email || '(no email)',
      phone: user.phone
    });

    return user;
  } catch (error) {
    // Handle duplicate email or phone error
    if (error.code === 11000) {
      console.warn(`[USER-CREATION] Duplicate key error. Trying to find existing user by phone`);

      // Try to find by phone first (primary identifier)
      user = await User.findOne({ phone, isDeleted: false });

      if (!user && email) {
        // If not found by phone and email provided, try by email
        user = await User.findOne({ email, isDeleted: false });
      }

      if (user) {
        console.log(`[USER-CREATION] Found existing user:`, {
          userId: user._id,
          name: user.name,
          email: user.email || '(no email)',
          phone: user.phone
        });
        return user;
      }
    }

    // If still failed, throw error
    console.error(`[USER-CREATION] Failed to create/find user:`, error);
    throw error;
  }
};

/**
 * Create event enrollment and update event ticket counts
 * Creates an enrollment record for the buyer with all tickets (buyer + others)
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<Object>} Object containing enrollment, users, and event data
 * @private
 */
const createEventEnrollment = async (payment) => {
  try {
    console.log('[ENROLLMENT] Starting enrollment creation for payment:', payment.orderId);

    // Extract buyer and others from metadata
    const { buyer, others = [], priceTierId, tierName, totalTickets = 1 } = payment.metadata;

    if (!buyer) {
      console.error('[ENROLLMENT] No buyer information found in payment metadata');
      return;
    }

    console.log('[ENROLLMENT] Buyer details:', {
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone
    });

    if (others.length > 0) {
      console.log(`[ENROLLMENT] Found ${others.length} additional ticket holder(s)`);
    }

    // Create/get buyer user
    const buyerUser = await findOrCreateUser(buyer);

    // Create/get users for all other ticket holders
    const otherUsers = [];
    for (const other of others) {
      console.log('[ENROLLMENT] Processing additional ticket holder:', {
        name: other.name,
        email: other.email,
        phone: other.phone
      });
      const otherUser = await findOrCreateUser(other);
      otherUsers.push({ user: otherUser, details: other });
    }

    // Check if enrollment already exists for this user and event
    const existingEnrollment = await EventEnrollment.findOne({
      userId: buyerUser._id,
      eventId: payment.eventId
    });

    if (existingEnrollment) {
      console.log('[ENROLLMENT] Enrollment already exists for this user and event');
      console.log('[ENROLLMENT] Returning existing enrollment data for email sending');

      // Fetch event details for email
      let event = null;
      if (payment.eventId) {
        event = await Event.findById(payment.eventId);
      }

      // Return existing enrollment data so emails can still be sent
      return {
        enrollment: existingEnrollment,
        buyerUser,
        otherUsers,
        event
      };
    }

    // Calculate price per ticket
    const ticketPrice = payment.finalAmount / totalTickets;

    // Create tickets Map with phone numbers as keys
    const ticketsMap = new Map();

    // Add buyer's ticket
    ticketsMap.set(buyer.phone, {
      status: 'ACTIVE',
      cancelledAt: null,
      cancellationReason: null,
      isTicketScanned: false,
      ticketScannedAt: null,
      ticketScannedBy: null
    });

    // Add other tickets
    for (const other of others) {
      ticketsMap.set(other.phone, {
        status: 'ACTIVE',
        cancelledAt: null,
        cancellationReason: null,
        isTicketScanned: false,
        ticketScannedAt: null,
        ticketScannedBy: null
      });
    }

    // Create enrollment
    const enrollment = new EventEnrollment({
      paymentId: payment.paymentId || payment.orderId,
      orderId: payment.orderId,
      userId: buyerUser._id,
      eventId: payment.eventId,
      ticketCount: totalTickets,
      tierName: tierName || null,
      ticketPrice: ticketPrice,
      tickets: ticketsMap
    });

    await enrollment.save();

    console.log('[ENROLLMENT] Enrollment created successfully:', {
      enrollmentId: enrollment._id,
      buyerId: buyerUser._id,
      eventId: payment.eventId,
      ticketCount: totalTickets,
      tickets: Array.from(ticketsMap.keys())
    });

    // Fetch event details for email
    let event = null;
    if (payment.eventId) {
      event = await Event.findById(payment.eventId);
      if (event) {
        event.ticketsSold = (event.ticketsSold || 0) + totalTickets;

        // Decrement availableSeats if it exists
        if (event.availableSeats != null && event.availableSeats > 0) {
          event.availableSeats = Math.max(0, event.availableSeats - totalTickets);
        }

        await event.save();

        console.log('[ENROLLMENT] Event ticket counts updated:', {
          eventId: event._id,
          ticketsSold: event.ticketsSold,
          availableSeats: event.availableSeats
        });
      }
    }

    // Return enrollment data for email sending
    return {
      enrollment,
      buyerUser,
      otherUsers,
      event
    };

  } catch (error) {
    console.error('[ENROLLMENT] Error creating enrollment:', error);
    // Don't throw error - webhook should still succeed even if enrollment fails
    return null;
  }
};

/**
 * Send enrollment confirmation via WhatsApp and Email
 * Generates individual QR codes, uploads to Cloudinary, and sends:
 * - WhatsApp messages to ALL ticket holders (required)
 * - Emails ONLY to ticket holders who have email addresses (optional)
 *
 * @param {Object} payment - Payment document from database
 * @param {Object} enrollment - Enrollment document from database
 * @param {Object} buyerUser - Buyer user document
 * @param {Array<Object>} otherUsers - Array of other ticket holder users with details
 * @param {Object} event - Event document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const sendEnrollmentEmails = async (payment, enrollment, buyerUser, otherUsers, event) => {
  try {
    const totalTicketHolders = 1 + otherUsers.length;
    console.log(`[WEBHOOK-NOTIFY] Preparing ticket notifications for ${totalTicketHolders} ticket holder(s)`);
    console.log(`[WEBHOOK-NOTIFY] Buyer info:`, {
      name: payment.metadata?.buyer?.name,
      email: payment.metadata?.buyer?.email || '(no email)',
      phone: payment.metadata?.buyer?.phone
    });

    const emails = [];
    const whatsappMessages = [];
    const eventName = event?.title || event?.name || 'Event';
    const eventDate = event?.startDate ? new Date(event.startDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : '';
    const eventLocation = event?.location || event?.city || '';

    // Process buyer's ticket
    try {
      console.log(`[WEBHOOK-NOTIFY] Processing buyer ticket for phone: ${payment.metadata.buyer.phone}`);

      // Generate QR code for buyer's ticket
      const buyerQRBuffer = await generateTicketQRCode({
        enrollmentId: enrollment._id.toString(),
        userId: buyerUser._id.toString(),
        eventId: payment.eventId.toString(),
        phone: payment.metadata.buyer.phone
      });

      const buyerQRFilename = generateQRFilename({
        eventName,
        phone: payment.metadata.buyer.phone
      });

      console.log(`[WEBHOOK-NOTIFY] ✓ Buyer QR code generated: ${buyerQRFilename} (${buyerQRBuffer.length} bytes)`);

      // Upload QR to Cloudinary for WhatsApp
      const buyerQRUrl = await uploadQRCodeToCloudinary({
        qrBuffer: buyerQRBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: payment.metadata.buyer.phone,
        eventName
      });

      // Add WhatsApp message for buyer (always)
      whatsappMessages.push({
        phone: payment.metadata.buyer.phone,
        name: payment.metadata.buyer.name,
        email: payment.metadata.buyer.email || '',
        eventName,
        qrCodeUrl: buyerQRUrl,
        // Logging parameters
        eventId: payment.eventId?.toString(),
        orderId: payment.orderId,
        userId: buyerUser._id.toString(),
        enrollmentId: enrollment._id.toString()
      });

      console.log(`[WEBHOOK-NOTIFY] ✓ Buyer WhatsApp message queued`);

      // Add email for buyer only if email exists
      if (payment.metadata?.buyer?.email) {
        const buyerEmailData = {
          email: payment.metadata.buyer.email,
          phone: payment.metadata.buyer.phone,
          userId: buyerUser._id.toString(),
          eventId: payment.eventId.toString(),
          enrollmentId: enrollment._id.toString(),
          name: payment.metadata.buyer.name,
          eventName,
          eventDate,
          eventLocation,
          isBuyer: true
        };

        emails.push({
          to: buyerEmailData.email,
          subject: `Your Ticket - ${eventName}`,
          html: generateTicketEmail(buyerEmailData),
          text: generateTicketEmailText(buyerEmailData),
          attachments: [
            {
              filename: buyerQRFilename,
              content: buyerQRBuffer,
              contentType: 'image/png'
            }
          ],
          // Logging parameters
          category: 'TICKET',
          eventId: payment.eventId?.toString(),
          orderId: payment.orderId,
          userId: buyerUser._id.toString(),
          enrollmentId: enrollment._id.toString()
        });

        console.log(`[WEBHOOK-NOTIFY] ✓ Buyer email queued (${buyerEmailData.email})`);
      } else {
        console.log(`[WEBHOOK-NOTIFY] ℹ Buyer has no email - skipping email notification`);
      }
    } catch (error) {
      console.error(`[WEBHOOK-NOTIFY] ✗ Failed to process buyer ticket: ${error.message}`);
    }

    // Process other ticket holders
    console.log(`[WEBHOOK-NOTIFY] Processing ${otherUsers.length} other ticket holder(s)`);
    for (const { user, details } of otherUsers) {
      try {
        console.log(`[WEBHOOK-NOTIFY] Processing ticket for phone: ${details.phone}`);

        // Generate QR code for this ticket holder
        const qrBuffer = await generateTicketQRCode({
          enrollmentId: enrollment._id.toString(),
          userId: user._id.toString(),
          eventId: payment.eventId.toString(),
          phone: details.phone
        });

        const qrFilename = generateQRFilename({
          eventName,
          phone: details.phone
        });

        console.log(`[WEBHOOK-NOTIFY] ✓ QR code generated for ${details.phone}: ${qrFilename} (${qrBuffer.length} bytes)`);

        // Upload QR to Cloudinary for WhatsApp
        const qrUrl = await uploadQRCodeToCloudinary({
          qrBuffer,
          enrollmentId: enrollment._id.toString(),
          phone: details.phone,
          eventName
        });

        // Add WhatsApp message (always)
        whatsappMessages.push({
          phone: details.phone,
          name: details.name,
          email: details.email || '',
          eventName,
          qrCodeUrl: qrUrl,
          // Logging parameters
          eventId: payment.eventId?.toString(),
          orderId: payment.orderId,
          userId: user._id.toString(),
          enrollmentId: enrollment._id.toString()
        });

        console.log(`[WEBHOOK-NOTIFY] ✓ WhatsApp message queued for ${details.phone}`);

        // Add email only if email exists
        if (details.email) {
          const emailData = {
            email: details.email,
            phone: details.phone,
            userId: user._id.toString(),
            eventId: payment.eventId.toString(),
            enrollmentId: enrollment._id.toString(),
            name: details.name,
            eventName,
            eventDate,
            eventLocation,
            isBuyer: false
          };

          emails.push({
            to: emailData.email,
            subject: `Your Ticket - ${eventName}`,
            html: generateTicketEmail(emailData),
            text: generateTicketEmailText(emailData),
            attachments: [
              {
                filename: qrFilename,
                content: qrBuffer,
                contentType: 'image/png'
              }
            ],
            // Logging parameters
            category: 'TICKET',
            eventId: payment.eventId?.toString(),
            orderId: payment.orderId,
            userId: user._id.toString(),
            enrollmentId: enrollment._id.toString()
          });

          console.log(`[WEBHOOK-NOTIFY] ✓ Email queued for ${details.email}`);
        } else {
          console.log(`[WEBHOOK-NOTIFY] ℹ ${details.phone} has no email - skipping email notification`);
        }
      } catch (error) {
        console.error(`[WEBHOOK-NOTIFY] ✗ Failed to process ticket for ${details.phone}: ${error.message}`);
      }
    }

    // Summary
    console.log(`[WEBHOOK-NOTIFY] === Notification Summary ===`);
    console.log(`[WEBHOOK-NOTIFY] WhatsApp messages queued: ${whatsappMessages.length}`);
    console.log(`[WEBHOOK-NOTIFY] Email messages queued: ${emails.length}`);

    // Send WhatsApp messages (to all ticket holders)
    if (whatsappMessages.length > 0) {
      try {
        console.log(`[WEBHOOK-NOTIFY] Sending ${whatsappMessages.length} WhatsApp message(s)...`);
        await sendBulkTicketWhatsApp(whatsappMessages);
        console.log('[WEBHOOK-NOTIFY] ✓ WhatsApp notifications sent successfully');
      } catch (whatsappError) {
        console.error(`[WEBHOOK-NOTIFY] ✗ WhatsApp sending failed: ${whatsappError.message}`);
        // Continue with emails even if WhatsApp fails
      }
    }

    // Send emails (only to those with email addresses)
    if (emails.length > 0) {
      try {
        console.log(`[WEBHOOK-NOTIFY] Sending ${emails.length} email(s)...`);
        await sendBulkEmails(emails);
        console.log('[WEBHOOK-NOTIFY] ✓ Email notifications sent successfully');
      } catch (emailError) {
        console.error(`[WEBHOOK-NOTIFY] ✗ Email sending failed: ${emailError.message}`);
      }
    } else {
      console.log('[WEBHOOK-NOTIFY] ℹ No emails to send (no ticket holders have email addresses)');
    }

    console.log('[WEBHOOK-NOTIFY] ✓ Notification process completed');

  } catch (error) {
    console.error(`[WEBHOOK-NOTIFY] ✗ Error in notification process: ${error.message}`);
    console.error(`[WEBHOOK-NOTIFY] Error stack:`, error.stack);
    // Don't throw error - webhook should still succeed even if notifications fail
  }
};

/**
 * Release voucher claim when payment fails
 * Extracts voucher info from payment metadata/notes and releases the claim
 * Only releases phones that actually exist in the voucher's claimedPhones
 *
 * @param {Object} payment - Payment document from database
 * @param {Object} [payment.metadata] - Payment metadata
 * @param {string} [payment.metadata.voucherId] - Voucher ID if voucher was claimed
 * @param {Array<string>} [payment.metadata.voucherPhones] - Phone numbers that claimed the voucher
 * @param {Object} [payment.metadata.buyer] - Buyer info with phone
 * @param {Array<Object>} [payment.metadata.others] - Other ticket holders with phones
 *
 * @returns {Promise<void>}
 * @private
 */
const releaseVoucherClaim = async (payment) => {
  try {
    const metadata = payment.metadata || {};
    const { voucherId, voucherClaimedPhones } = metadata;

    if (!voucherId) {
      console.log('[VOUCHER-RELEASE] No voucher ID found in payment metadata');
      return;
    }

    // Use voucherClaimedPhones from metadata - these are the phones that were actually claimed
    let phonesToRelease = voucherClaimedPhones || [];

    if (phonesToRelease.length === 0) {
      console.log('[VOUCHER-RELEASE] No voucherClaimedPhones found in payment metadata');
      return;
    }

    console.log('[VOUCHER-RELEASE] Releasing voucher claim:', {
      voucherId,
      phones: phonesToRelease
    });

    // Fetch voucher to verify phones exist in claimedPhones
    const voucher = await Voucher.findById(voucherId);

    if (!voucher) {
      console.warn('[VOUCHER-RELEASE] Voucher not found:', voucherId);
      return;
    }

    // Filter to only phones that exist in claimedPhones (safety check)
    const phonesInVoucher = phonesToRelease.filter(phone =>
      voucher.claimedPhones.includes(phone)
    );

    if (phonesInVoucher.length === 0) {
      console.log('[VOUCHER-RELEASE] No matching phones found in voucher claimedPhones');
      return;
    }

    console.log('[VOUCHER-RELEASE] Found matching phones in claimedPhones:', {
      voucherId,
      matchingPhones: phonesInVoucher,
      totalToRelease: phonesInVoucher.length
    });

    // Release the voucher for matching phones (removes from claimedPhones, no usageCount change)
    const updatedVoucher = await Voucher.releaseVoucher(voucherId, phonesInVoucher);

    if (updatedVoucher) {
      console.log('[VOUCHER-RELEASE] ✓ Voucher claim released successfully:', {
        voucherId,
        releasedPhones: phonesInVoucher
      });
    } else {
      console.warn('[VOUCHER-RELEASE] Failed to update voucher:', voucherId);
    }
  } catch (error) {
    console.error('[VOUCHER-RELEASE] ✗ Error releasing voucher claim:', error.message);
    // Don't throw - webhook should still succeed even if voucher release fails
  }
};

/**
 * Log customer details from payment metadata
 * Logs all customer information for club/combo purchases
 *
 * @param {Object} payment - Payment document from database
 * @param {Object} [payment.metadata] - Payment metadata
 * @param {Array} [payment.metadata.customers] - Array of customers
 *
 * @returns {void}
 * @private
 */
const logCustomerDetails = (payment) => {
  if (payment.metadata?.customers && Array.isArray(payment.metadata.customers)) {
    const customers = payment.metadata.customers;
    console.log('=== Club/Combo Purchase - Customer Details ===');
    console.log(`Number of customers: ${customers.length}`);
    customers.forEach((customer, index) => {
      console.log(`Customer ${index + 1}:`, {
        name: customer.name || 'N/A',
        email: customer.email || 'N/A',
        phone: customer.phone || 'N/A'
      });
    });
    console.log('============================================');
  }
};

/**
 * Send voucher QR codes via WhatsApp to all claimed phone numbers
 * Generates QR codes for each phone in metadata and sends via WhatsApp
 *
 * @param {Object} payment - Payment document from database
 * @param {Object} [payment.metadata] - Payment metadata
 * @param {string} [payment.metadata.voucherId] - Voucher ID if voucher was claimed
 * @param {Object} [payment.metadata.buyer] - Buyer info with phone and name
 * @param {Array<Object>} [payment.metadata.others] - Other ticket holders with phones and names
 *
 * @returns {Promise<void>}
 * @private
 */
const sendVoucherQRs = async (payment) => {
  try {
    const metadata = payment.metadata || {};
    const { voucherId, voucherClaimedPhones } = metadata;

    if (!voucherId) {
      console.log('[VOUCHER-QR] No voucher ID found in payment metadata - skipping voucher QR sending');
      return;
    }

    if (!voucherClaimedPhones || voucherClaimedPhones.length === 0) {
      console.log('[VOUCHER-QR] No voucherClaimedPhones in metadata - skipping voucher QR sending');
      return;
    }

    console.log('[VOUCHER-QR] ========== STARTING VOUCHER QR SENDING ==========');
    console.log('[VOUCHER-QR] Voucher ID:', voucherId);
    console.log('[VOUCHER-QR] Claimed phones:', voucherClaimedPhones);

    // Fetch voucher details
    const voucher = await Voucher.findById(voucherId);

    if (!voucher) {
      console.warn('[VOUCHER-QR] Voucher not found:', voucherId);
      return;
    }

    console.log('[VOUCHER-QR] Voucher found:', {
      code: voucher.code,
      title: voucher.title
    });

    // Build phone to name map from buyer and others
    const phoneNameMap = new Map();

    if (metadata.buyer?.phone) {
      const normalizedPhone = metadata.buyer.phone.slice(-10);
      phoneNameMap.set(normalizedPhone, metadata.buyer.name || 'Customer');
    }

    if (metadata.others && Array.isArray(metadata.others)) {
      for (const other of metadata.others) {
        if (other.phone) {
          const normalizedPhone = other.phone.slice(-10);
          phoneNameMap.set(normalizedPhone, other.name || 'Customer');
        }
      }
    }

    // Use voucherClaimedPhones from metadata - these are the phones that were actually claimed
    const phonesToSend = voucherClaimedPhones.map(phone => ({
      phone,
      name: phoneNameMap.get(phone) || 'Customer'
    }));

    console.log('[VOUCHER-QR] Phones to send voucher QR:', phonesToSend);

    // Confirm voucher claim - increment usageCount for successful payment
    try {
      const confirmedVoucher = await Voucher.confirmVoucherClaim(voucherId, phonesToSend.length);
      if (confirmedVoucher) {
        console.log('[VOUCHER-QR] ✓ Voucher claim confirmed:', {
          voucherId,
          phoneCount: phonesToSend.length,
          newUsageCount: confirmedVoucher.usageCount
        });
      } else {
        console.warn('[VOUCHER-QR] Failed to confirm voucher claim:', voucherId);
      }
    } catch (confirmError) {
      console.error('[VOUCHER-QR] ✗ Error confirming voucher claim:', confirmError.message);
      // Continue with QR sending even if confirmation fails
    }

    // Generate QR codes and prepare WhatsApp messages
    const whatsappMessages = [];

    for (const { phone, name } of phonesToSend) {
      try {
        console.log(`[VOUCHER-QR] Processing voucher QR for phone: ${phone}`);

        // Generate voucher QR code
        const qrBuffer = await generateVoucherQRCode({
          phone,
          voucherCode: voucher.code
        });

        console.log(`[VOUCHER-QR] ✓ QR code generated for ${phone} (${qrBuffer.length} bytes)`);

        // Upload QR to Cloudinary
        const qrUrl = await uploadVoucherQRCodeToCloudinary({
          qrBuffer,
          voucherCode: voucher.code,
          phone
        });

        console.log(`[VOUCHER-QR] ✓ QR code uploaded for ${phone}: ${qrUrl}`);

        // Add to WhatsApp messages queue
        whatsappMessages.push({
          phone,
          name,
          voucherTitle: voucher.title,
          qrCodeUrl: qrUrl,
          // Logging parameter
          voucherId: voucherId
        });

        console.log(`[VOUCHER-QR] ✓ WhatsApp message queued for ${phone}`);
      } catch (error) {
        console.error(`[VOUCHER-QR] ✗ Failed to process voucher QR for ${phone}:`, error.message);
        // Continue with other phones even if one fails
      }
    }

    // Send WhatsApp messages
    if (whatsappMessages.length > 0) {
      try {
        console.log(`[VOUCHER-QR] Sending ${whatsappMessages.length} voucher WhatsApp message(s)...`);
        await sendBulkVoucherWhatsApp(whatsappMessages);
        console.log('[VOUCHER-QR] ✓ Voucher WhatsApp messages sent successfully');
      } catch (whatsappError) {
        console.error(`[VOUCHER-QR] ✗ Voucher WhatsApp sending failed:`, whatsappError.message);
      }
    }

    console.log('[VOUCHER-QR] ========== VOUCHER QR SENDING COMPLETE ==========');

  } catch (error) {
    console.error('[VOUCHER-QR] ✗ Error in voucher QR sending process:', error.message);
    // Don't throw - webhook should still succeed even if voucher QR sending fails
  }
};

/**
 * Confirm session booking after successful payment
 * Updates booking status, increments session booked slots, and sends Calendly link
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const confirmSessionBooking = async (payment) => {
  try {
    console.log('[SESSION-WEBHOOK] Starting session booking confirmation for payment:', payment.orderId);

    const { bookingReference } = payment.metadata || {};

    if (!bookingReference) {
      console.error('[SESSION-WEBHOOK] No booking reference found in payment metadata');
      return;
    }

    // Find the booking
    const booking = await SessionBooking.findOne({ bookingReference });

    if (!booking) {
      console.error('[SESSION-WEBHOOK] Booking not found for reference:', bookingReference);
      return;
    }

    // Check if booking is already confirmed
    if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
      console.log('[SESSION-WEBHOOK] Booking already confirmed:', bookingReference);
      return;
    }

    // Find the session
    const session = await Session.findById(booking.sessionId);

    if (!session) {
      console.error('[SESSION-WEBHOOK] Session not found for booking:', bookingReference);
      return;
    }

    // Update booking status
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    console.log('[SESSION-WEBHOOK] Booking confirmed:', {
      bookingReference: booking.bookingReference,
      sessionId: session._id,
      sessionTitle: session.title
    });

    // Increment session booked slots
    try {
      await session.bookSlot();
      console.log('[SESSION-WEBHOOK] Session slot booked:', {
        sessionId: session._id,
        bookedSlots: session.bookedSlots + 1
      });
    } catch (slotError) {
      console.error('[SESSION-WEBHOOK] Error booking slot:', slotError.message);
      // Continue - payment was successful
    }

    // Send Calendly link via email and WhatsApp
    await sendSessionConfirmation(payment, booking, session);

    console.log('[SESSION-WEBHOOK] ✓ Session booking confirmed successfully');

  } catch (error) {
    console.error('[SESSION-WEBHOOK] ✗ Error confirming session booking:', error.message);
    // Don't throw - webhook should still succeed
  }
};

/**
 * Send session booking confirmation with Calendly link
 * Sends to both email and WhatsApp if available
 *
 * @param {Object} payment - Payment document
 * @param {Object} booking - SessionBooking document
 * @param {Object} session - Session document
 *
 * @returns {Promise<void>}
 * @private
 */
const sendSessionConfirmation = async (payment, booking, session) => {
  try {
    console.log('[SESSION-CONFIRM] Sending session booking confirmation');

    const { buyer } = payment.metadata || {};
    const calendlyLink = session.calendlyLink;
    const hostEmail = session.hostEmail;
    const hostPhone = session.hostPhone;

    // Prepare notification data
    const userEmail = booking.userEmail || buyer?.email;
    const userPhone = booking.userPhone || buyer?.phone;
    const userName = buyer?.name || 'Customer';

    console.log('[SESSION-CONFIRM] Recipient info:', {
      email: userEmail || '(no email)',
      phone: userPhone || '(no phone)',
      calendlyLink: calendlyLink || '(no link)'
    });

    // Send email notification
    if (userEmail) {
      try {
        const emailContent = {
          to: userEmail,
          subject: `Session Booking Confirmed - ${session.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your Session Booking is Confirmed!</h2>
              <p>Hi ${userName},</p>
              <p>Thank you for booking <strong>${session.title}</strong> with ${session.host}.</p>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Booking Details</h3>
                <p><strong>Session:</strong> ${session.title}</p>
                <p><strong>Host:</strong> ${session.host}</p>
                <p><strong>Duration:</strong> ${session.duration} minutes</p>
                <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
                <p><strong>Amount Paid:</strong> ₹${booking.amountPaid}</p>
              </div>

              ${calendlyLink ? `
              <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📅 Schedule Your Session</h3>
                <p>Please use the link below to schedule your session at a convenient time:</p>
                <a href="${calendlyLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Schedule Now</a>
              </div>
              ` : ''}

              ${hostEmail || hostPhone ? `
              <div style="margin-top: 20px;">
                <h3>Contact Information</h3>
                ${hostEmail ? `<p><strong>Email:</strong> ${hostEmail}</p>` : ''}
                ${hostPhone ? `<p><strong>Phone:</strong> ${hostPhone}</p>` : ''}
              </div>
              ` : ''}

              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you have any questions, please contact us at support@motivata.in
              </p>
            </div>
          `,
          text: `Your Session Booking is Confirmed!

Hi ${userName},

Thank you for booking "${session.title}" with ${session.host}.

Booking Details:
- Session: ${session.title}
- Host: ${session.host}
- Duration: ${session.duration} minutes
- Booking Reference: ${booking.bookingReference}
- Amount Paid: ₹${booking.amountPaid}

${calendlyLink ? `Schedule Your Session: ${calendlyLink}` : ''}

${hostEmail ? `Host Email: ${hostEmail}` : ''}
${hostPhone ? `Host Phone: ${hostPhone}` : ''}

If you have any questions, please contact us at support@motivata.in
`,
          // Logging parameters
          category: 'SESSION_BOOKING',
          sessionId: session._id?.toString(),
          orderId: payment.orderId,
          bookingReference: booking.bookingReference
        };

        await sendBulkEmails([emailContent]);
        console.log('[SESSION-CONFIRM] ✓ Email sent successfully');
      } catch (emailError) {
        console.error('[SESSION-CONFIRM] ✗ Email sending failed:', emailError.message);
      }
    } else {
      console.log('[SESSION-CONFIRM] ℹ No email address - skipping email notification');
    }

    // Send WhatsApp notification
    if (userPhone) {
      try {
        // Import WhatsApp utility dynamically
        const { sendWhatsAppMessage } = await import('../../utils/whatsapp.util.js');

        let message = `🎉 *Session Booking Confirmed!*\n\n`;
        message += `Hi ${userName},\n\n`;
        message += `Your booking for *${session.title}* with ${session.host} is confirmed!\n\n`;
        message += `📋 *Booking Details*\n`;
        message += `• Reference: ${booking.bookingReference}\n`;
        message += `• Duration: ${session.duration} minutes\n`;
        message += `• Amount: ₹${booking.amountPaid}\n\n`;

        if (calendlyLink) {
          message += `📅 *Schedule Your Session*\n`;
          message += `Click here to pick your slot: ${calendlyLink}\n\n`;
        }

        if (hostEmail || hostPhone) {
          message += `📞 *Contact Host*\n`;
          if (hostEmail) message += `Email: ${hostEmail}\n`;
          if (hostPhone) message += `Phone: ${hostPhone}\n`;
        }

        await sendWhatsAppMessage({
          phone: userPhone,
          message,
          // Logging parameters
          category: 'SESSION_BOOKING',
          sessionId: session._id?.toString(),
          orderId: payment.orderId,
          bookingReference: booking.bookingReference
        });

        console.log('[SESSION-CONFIRM] ✓ WhatsApp message sent successfully');
      } catch (whatsappError) {
        console.error('[SESSION-CONFIRM] ✗ WhatsApp sending failed:', whatsappError.message);
      }
    } else {
      console.log('[SESSION-CONFIRM] ℹ No phone number - skipping WhatsApp notification');
    }

    console.log('[SESSION-CONFIRM] ✓ Session confirmation notifications completed');

  } catch (error) {
    console.error('[SESSION-CONFIRM] ✗ Error sending session confirmation:', error.message);
    // Don't throw - webhook should still succeed
  }
};

/**
 * Handle session booking failure/cancellation
 * Updates booking status and releases the pending slot
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const cancelSessionBooking = async (payment) => {
  try {
    console.log('[SESSION-WEBHOOK] Handling session booking failure for payment:', payment.orderId);

    const { bookingReference } = payment.metadata || {};

    if (!bookingReference) {
      console.log('[SESSION-WEBHOOK] No booking reference found - skipping');
      return;
    }

    // Find the booking
    const booking = await SessionBooking.findOne({ bookingReference });

    if (!booking) {
      console.log('[SESSION-WEBHOOK] Booking not found for reference:', bookingReference);
      return;
    }

    // Only cancel if booking is still pending
    if (booking.status !== 'pending') {
      console.log('[SESSION-WEBHOOK] Booking is not pending, skipping cancellation:', booking.status);
      return;
    }

    // Cancel the booking
    await booking.cancel('admin', 'Payment failed');

    console.log('[SESSION-WEBHOOK] ✓ Session booking cancelled:', bookingReference);

  } catch (error) {
    console.error('[SESSION-WEBHOOK] ✗ Error cancelling session booking:', error.message);
    // Don't throw - webhook should still succeed
  }
};

/**
 * Handle session booking refund
 * Updates booking status and releases the session slot
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const handleSessionRefund = async (payment) => {
  try {
    console.log('[SESSION-REFUND] Starting session refund for payment:', payment.orderId);

    const { bookingReference } = payment.metadata || {};

    if (!bookingReference) {
      console.log('[SESSION-REFUND] No booking reference found - skipping');
      return;
    }

    // Find the booking
    const booking = await SessionBooking.findOne({ bookingReference });

    if (!booking) {
      console.log('[SESSION-REFUND] Booking not found for reference:', bookingReference);
      return;
    }

    // Update booking status
    booking.paymentStatus = 'refunded';
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = 'Payment refunded';
    booking.cancelledBy = 'admin';
    await booking.save();

    console.log('[SESSION-REFUND] Booking marked as refunded:', bookingReference);

    // Release the session slot
    if (payment.sessionId) {
      const session = await Session.findById(payment.sessionId);
      if (session) {
        await session.cancelBooking();
        console.log('[SESSION-REFUND] Session slot released:', {
          sessionId: session._id,
          bookedSlots: session.bookedSlots
        });
      }
    }

    console.log('[SESSION-REFUND] ✓ Session refund processed successfully');

  } catch (error) {
    console.error('[SESSION-REFUND] ✗ Error processing session refund:', error.message);
    // Don't throw - webhook should still succeed
  }
};

/**
 * Update related entities after successful payment
 * Routes to appropriate handler based on payment type
 *
 * @param {Object} payment - Payment document from database
 * @param {string} [payment.couponCode] - Coupon code used (if any)
 *
 * @returns {Promise<void>}
 * @private
 */
const updateRelatedEntities = async (payment) => {
  // Log customer details if present
  logCustomerDetails(payment);

  // Route to appropriate handler based on payment type
  if (payment.type === 'SESSION') {
    // Handle session booking confirmation
    await confirmSessionBooking(payment);
    console.log('✓ Session payment processed successfully.');
    return;
  }

  // Default: EVENT type - existing flow
  // Create users and event enrollment
  const enrollmentData = await createEventEnrollment(payment);

  // Send enrollment confirmation emails if enrollment was created successfully
  if (enrollmentData) {
    const { enrollment, buyerUser, otherUsers, event } = enrollmentData;
    await sendEnrollmentEmails(payment, enrollment, buyerUser, otherUsers, event);
  }

  // Send voucher QR codes if voucher was used
  await sendVoucherQRs(payment);

  // Increment coupon usage if coupon was used
  if (payment.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: payment.couponCode },
      { $inc: { usageCount: 1 } }
    );
    console.log(`✓ Coupon usage incremented: ${payment.couponCode}`);
  }

  console.log('✓ Payment processed. Users, enrollment, and emails sent successfully.');
};

/**
 * Handle enrollment refund
 * Marks all tickets as REFUNDED and reverses event ticket counts
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const handleEnrollmentRefund = async (payment) => {
  try {
    console.log('[REFUND] Starting enrollment refund for payment:', payment.orderId);

    // Find enrollment by orderId
    const enrollment = await EventEnrollment.findOne({ orderId: payment.orderId });

    if (!enrollment) {
      console.warn('[REFUND] No enrollment found for order:', payment.orderId);
      return;
    }

    console.log('[REFUND] Found enrollment:', {
      enrollmentId: enrollment._id,
      userId: enrollment.userId,
      eventId: enrollment.eventId,
      ticketCount: enrollment.ticketCount
    });

    // Mark all tickets as REFUNDED
    const ticketsMap = enrollment.tickets;
    for (const [phone, ticketData] of ticketsMap.entries()) {
      ticketsMap.set(phone, {
        ...ticketData,
        status: 'REFUNDED',
        cancelledAt: new Date(),
        cancellationReason: 'Payment refunded'
      });
    }

    enrollment.tickets = ticketsMap;
    await enrollment.save();

    console.log('[REFUND] All tickets marked as REFUNDED');

    // Reverse event ticket counts
    if (payment.eventId) {
      const event = await Event.findById(payment.eventId);
      if (event) {
        event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - enrollment.ticketCount);

        // Increment availableSeats if it exists
        if (event.availableSeats != null) {
          event.availableSeats = event.availableSeats + enrollment.ticketCount;
        }

        await event.save();

        console.log('[REFUND] Event ticket counts reversed:', {
          eventId: event._id,
          ticketsSold: event.ticketsSold,
          availableSeats: event.availableSeats
        });
      }
    }

  } catch (error) {
    console.error('[REFUND] Error handling enrollment refund:', error);
    // Don't throw error - webhook should still succeed
  }
};

/**
 * Reverse related entity updates after refund
 * Routes to appropriate handler based on payment type
 *
 * @param {Object} payment - Payment document from database
 * @param {string} [payment.couponCode] - Coupon code used (if any)
 *
 * @returns {Promise<void>}
 * @private
 */
const reverseRelatedEntities = async (payment) => {
  // Log customer details if present
  logCustomerDetails(payment);

  // Route to appropriate handler based on payment type
  if (payment.type === 'SESSION') {
    // Handle session refund
    await handleSessionRefund(payment);
    console.log('✓ Session refund processed successfully.');
    return;
  }

  // Default: EVENT type - existing flow
  // Handle enrollment refund
  await handleEnrollmentRefund(payment);

  // Release voucher claim if voucher was used
  await releaseVoucherClaim(payment);

  // Decrement coupon usage if coupon was used
  if (payment.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: payment.couponCode },
      { $inc: { usageCount: -1 } }
    );
    console.log(`✓ Coupon usage decremented: ${payment.couponCode}`);
  }

  console.log('✓ Refund processed. Enrollment cancelled and ticket counts reversed.');
};

/**
 * Handle session booking failure (called on payment failure)
 * Routes to cancelSessionBooking for SESSION type payments
 *
 * @param {Object} payment - Payment document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentFailureByType = async (payment) => {
  if (payment.type === 'SESSION') {
    await cancelSessionBooking(payment);
  }
  // For EVENT type, voucher release is already handled in releaseVoucherClaim
};

export default {
  handleWebhook
};
