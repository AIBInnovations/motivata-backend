/**
 * @fileoverview Razorpay utility for payment gateway operations
 * Provides Razorpay SDK initialization and signature verification utilities
 * @module utils/razorpay
 *
 * @requires razorpay
 * @requires crypto
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Lazily initialized Razorpay instance
 * @type {Razorpay|null}
 * @private
 */
let _razorpayInstance = null;

/**
 * Get Razorpay SDK instance
 * Initialized with credentials from environment variables (lazy initialization)
 *
 * @type {Razorpay}
 * @constant
 *
 * @description
 * This instance is used throughout the application to interact with Razorpay APIs.
 * Requires the following environment variables:
 * - RAZORPAY_KEY_ID: Your Razorpay API key ID (starts with 'rzp_test_' or 'rzp_live_')
 * - RAZORPAY_KEY_SECRET: Your Razorpay API key secret
 *
 * Uses lazy initialization to ensure environment variables are loaded before accessing them.
 *
 * @example
 * // Create an order
 * const order = await razorpayInstance.orders.create({
 *   amount: 50000,
 *   currency: 'INR',
 *   receipt: 'receipt_123'
 * });
 *
 * @example
 * // Fetch order details
 * const order = await razorpayInstance.orders.fetch('order_MhXXXXXXXXXX');
 *
 * @see {@link https://razorpay.com/docs/api/} Razorpay API Documentation
 */
export const razorpayInstance = new Proxy({}, {
  get(target, prop) {
    // Lazy initialization on first access
    if (!_razorpayInstance) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error(
          'Razorpay credentials not found. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file'
        );
      }

      _razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      console.log('✓ Razorpay SDK initialized');
    }

    return _razorpayInstance[prop];
  }
});

/**
 * Verify Razorpay webhook signature
 * Validates that webhook request is genuinely from Razorpay by verifying HMAC signature
 *
 * @param {string} signature - Webhook signature from 'x-razorpay-signature' header
 * @param {Object} payload - Complete webhook payload body
 *
 * @returns {boolean} True if signature is valid, false otherwise
 *
 * @description
 * Razorpay signs webhook payloads with HMAC-SHA256 using your webhook secret.
 * This function recreates the signature and compares it with the received signature
 * to ensure the webhook is authentic and hasn't been tampered with.
 *
 * The signature is created by:
 * 1. Converting the entire payload to JSON string
 * 2. Creating HMAC-SHA256 hash using RAZORPAY_KEY_SECRET
 * 3. Comparing with signature from header
 *
 * @example
 * // In webhook handler
 * const signature = req.headers['x-razorpay-signature'];
 * const payload = req.body;
 *
 * const isValid = verifyWebhookSignature(signature, payload);
 * if (!isValid) {
 *   return res.status(401).json({ error: 'Invalid signature' });
 * }
 *
 * @example
 * // Returns true for valid signature
 * verifyWebhookSignature('abc123...', {
 *   event: 'payment.captured',
 *   payload: { ... }
 * }); // true
 *
 * @see {@link https://razorpay.com/docs/webhooks/validate-test/} Razorpay Webhook Validation
 */
export const verifyWebhookSignature = (signature, payload) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
};

/**
 * Verify Razorpay payment signature
 * Validates payment authenticity by verifying signature after successful payment
 *
 * @param {string} orderId - Razorpay order ID (e.g., 'order_MhXXXXXXXXXX')
 * @param {string} paymentId - Razorpay payment ID (e.g., 'pay_MhYYYYYYYYYY')
 * @param {string} signature - Payment signature received from Razorpay
 *
 * @returns {boolean} True if signature is valid, false otherwise
 *
 * @description
 * After a successful payment, Razorpay sends back a signature that needs to be verified
 * to ensure the payment details haven't been tampered with during the payment flow.
 *
 * The signature is created by:
 * 1. Concatenating orderId and paymentId with pipe separator: 'orderId|paymentId'
 * 2. Creating HMAC-SHA256 hash using RAZORPAY_KEY_SECRET
 * 3. Comparing with signature received from Razorpay
 *
 * This is typically used when implementing custom payment success handling
 * (as opposed to relying solely on webhooks).
 *
 * @example
 * // After payment completion (from Razorpay redirect/callback)
 * const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
 *
 * const isValid = verifyPaymentSignature(
 *   razorpay_order_id,
 *   razorpay_payment_id,
 *   razorpay_signature
 * );
 *
 * if (isValid) {
 *   // Payment is genuine, update order status
 * } else {
 *   // Invalid signature, possible tampering
 * }
 *
 * @example
 * // Returns true for valid signature
 * verifyPaymentSignature(
 *   'order_MhXXXXXXXXXX',
 *   'pay_MhYYYYYYYYYY',
 *   'abc123def456...'
 * ); // true
 *
 * @see {@link https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#step-3-verify-the-payment-signature} Razorpay Payment Signature Verification
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Payment signature verification error:', error);
    return false;
  }
};

export default {
  razorpayInstance,
  verifyWebhookSignature,
  verifyPaymentSignature,
};
