/**
 * @fileoverview Razorpay webhook handler
 * Processes Razorpay webhook events and updates payment records accordingly
 * @module webhooks/razorpay
 */

import { verifyWebhookSignature } from '../../utils/razorpay.util.js';
import Payment from '../../schema/Payment.schema.js';
import Event from '../../schema/Event.schema.js';
import Coupon from '../../schema/Coupon.schema.js';
import responseUtil from '../../utils/response.util.js';

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
 *
 * @returns {Promise<void>}
 * @private
 */
const handlePaymentLinkPaid = async (paymentLinkEntity) => {
  console.log('Processing payment_link.paid event');

  const { reference_id: orderId } = paymentLinkEntity;

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
    razorpayPaymentLinkEntity: paymentLinkEntity
  };
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
 * Update related entities after successful payment
 * Increments coupon usage count and decrements event available seats
 *
 * @param {Object} payment - Payment document from database
 * @param {string} [payment.couponCode] - Coupon code used (if any)
 * @param {string} payment.type - Payment type
 * @param {string} [payment.eventId] - Event ID (if type is EVENT)
 *
 * @returns {Promise<void>}
 * @private
 */
const updateRelatedEntities = async (payment) => {
  // Log customer details if present
  logCustomerDetails(payment);
  // Increment coupon usage if coupon was used
  if (payment.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: payment.couponCode },
      { $inc: { usageCount: 1 } }
    );
    console.log(`✓ Coupon usage incremented: ${payment.couponCode}`);
  }

  // Decrement available seats if event payment
  if (payment.type === 'EVENT' && payment.eventId) {
    await Event.findByIdAndUpdate(
      payment.eventId,
      { $inc: { availableSeats: -1 } }
    );
    console.log(`✓ Event seats decremented for event: ${payment.eventId}`);
  }
};

/**
 * Reverse related entity updates after refund
 * Decrements coupon usage count and increments event available seats
 *
 * @param {Object} payment - Payment document from database
 * @param {string} [payment.couponCode] - Coupon code used (if any)
 * @param {string} payment.type - Payment type
 * @param {string} [payment.eventId] - Event ID (if type is EVENT)
 *
 * @returns {Promise<void>}
 * @private
 */
const reverseRelatedEntities = async (payment) => {
  // Log customer details if present
  logCustomerDetails(payment);

  // Decrement coupon usage if coupon was used
  if (payment.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: payment.couponCode },
      { $inc: { usageCount: -1 } }
    );
    console.log(`✓ Coupon usage decremented: ${payment.couponCode}`);
  }

  // Increment available seats if event payment
  if (payment.type === 'EVENT' && payment.eventId) {
    await Event.findByIdAndUpdate(
      payment.eventId,
      { $inc: { availableSeats: 1 } }
    );
    console.log(`✓ Event seats incremented for event: ${payment.eventId}`);
  }
};

export default {
  handleWebhook
};
