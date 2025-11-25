/**
 * @fileoverview Razorpay payment routes
 * Defines all Razorpay payment integration endpoints
 * @module routes/razorpay
 *
 * Base path: /api/web/razorpay
 *
 * @requires express
 * @requires ./razorpay.controller
 * @requires ./razorpay.webhook
 */

import express from 'express';
import { createOrder, getPaymentStatus } from './razorpay.controller.js';
import { handleWebhook } from './razorpay.webhook.js';

const router = express.Router();

/**
 * @route POST /api/web/razorpay/create-order
 * @group Razorpay Payment - Razorpay payment operations
 * @access Public
 *
 * @description
 * Creates a new Razorpay payment order and payment link.
 * Returns a short URL that can be used to redirect the user to Razorpay's payment page.
 * Supports club/combo purchases with multiple customers (SMS/email notifications disabled).
 *
 * @handler {Function} createOrder - Controller function to create payment order
 *
 * @example
 * // Single Purchase
 * POST /api/web/razorpay/create-order
 * Content-Type: application/json
 *
 * Request Body:
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
 * // Club/Combo Purchase (Multiple Customers)
 * POST /api/web/razorpay/create-order
 * Content-Type: application/json
 *
 * Request Body:
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
 * Response (201 Created):
 * {
 *   "status": 201,
 *   "message": "Payment order created successfully",
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "paymentUrl": "https://rzp.io/i/aBcDeFg",
 *     ...
 *   }
 * }
 */
router.post('/create-order', createOrder);

/**
 * @route GET /api/web/razorpay/status/:orderId
 * @group Razorpay Payment - Razorpay payment operations
 * @access Public
 *
 * @description
 * Retrieves the current status of a payment by order ID.
 * Designed for long polling pattern - client can repeatedly call this endpoint
 * to check if payment status has changed from PENDING to SUCCESS/FAILED.
 * If payment is still PENDING, it will also sync with Razorpay API for latest status.
 *
 * @param {string} orderId.path.required - Razorpay order ID
 *
 * @handler {Function} getPaymentStatus - Controller function to get payment status
 *
 * @example
 * GET /api/web/razorpay/status/order_MhXXXXXXXXXX
 *
 * Response (200 OK):
 * {
 *   "status": 200,
 *   "message": "Payment status retrieved",
 *   "data": {
 *     "orderId": "order_MhXXXXXXXXXX",
 *     "paymentId": "pay_MhYYYYYYYYYY",
 *     "status": "SUCCESS",
 *     "amount": 1500,
 *     ...
 *   }
 * }
 *
 * @example
 * // Long Polling Implementation (Frontend)
 * const checkPaymentStatus = async (orderId) => {
 *   const interval = setInterval(async () => {
 *     const response = await fetch(`/api/web/razorpay/status/${orderId}`);
 *     const data = await response.json();
 *
 *     if (data.data.status === 'SUCCESS') {
 *       clearInterval(interval);
 *       // Handle success
 *     } else if (data.data.status === 'FAILED') {
 *       clearInterval(interval);
 *       // Handle failure
 *     }
 *   }, 3000); // Poll every 3 seconds
 * };
 */
router.get('/status/:orderId', getPaymentStatus);

/**
 * @route POST /api/web/razorpay/webhook
 * @group Razorpay Payment - Razorpay payment operations
 * @access Public (signature verified)
 *
 * @description
 * Webhook endpoint for receiving payment events from Razorpay.
 * Automatically updates payment records and related entities based on webhook events.
 * No authentication required - security is handled via webhook signature verification.
 *
 * IMPORTANT: This endpoint must be registered in your Razorpay Dashboard:
 * 1. Go to Settings > Webhooks in Razorpay Dashboard
 * 2. Add webhook URL: https://yourdomain.com/api/web/razorpay/webhook
 * 3. Use your RAZORPAY_KEY_SECRET as the webhook secret
 * 4. Subscribe to relevant events (or all events)
 *
 * @handler {Function} handleWebhook - Webhook handler function
 *
 * @example
 * // Razorpay sends webhook POST requests like this:
 * POST /api/web/razorpay/webhook
 * Content-Type: application/json
 * x-razorpay-signature: <signature_hash>
 *
 * Request Body:
 * {
 *   "event": "payment.captured",
 *   "payload": {
 *     "payment": {
 *       "entity": {
 *         "id": "pay_MhYYYYYYYYYY",
 *         "order_id": "order_MhXXXXXXXXXX",
 *         "amount": 150000,
 *         "currency": "INR",
 *         "status": "captured",
 *         ...
 *       }
 *     }
 *   }
 * }
 *
 * Response (200 OK):
 * {
 *   "status": 200,
 *   "message": "Webhook processed successfully",
 *   "data": {}
 * }
 *
 * @see {@link https://razorpay.com/docs/webhooks/} Razorpay Webhooks Documentation
 */
router.post('/webhook', handleWebhook);

export default router;
