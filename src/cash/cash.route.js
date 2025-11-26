/**
 * @fileoverview Cash payment routes
 * Defines all cash payment endpoints for direct cash transactions
 * @module routes/cash
 *
 * Base path: /api/web/cash
 *
 * @requires express
 * @requires ./cash.controller
 */

import express from 'express';
import { createCashOrder, createCashPartner } from './cash.controller.js';

const router = express.Router();

/**
 * @route POST /api/web/cash/partner
 * @group Cash Payment - Cash partner management
 * @access Public (should be protected with authentication in production)
 *
 * @description
 * Creates a new cash partner record with an automatically generated unique 6-digit code.
 * The partner code is used to identify and authenticate cash partners when processing cash orders.
 *
 * Key Features:
 * - Automatically generates unique 6-digit partner code
 * - Validates partner name and phone number
 * - Prevents duplicate phone numbers
 * - Returns complete partner details including generated code
 *
 * @handler {Function} createCashPartner - Controller function to create cash partner
 *
 * @example
 * POST /api/web/cash/partner
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "name": "Downtown Store",
 *   "phone": "+919876543210"
 * }
 *
 * Response (201 Created):
 * {
 *   "status": 201,
 *   "message": "Cash partner created successfully",
 *   "error": null,
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "name": "Downtown Store",
 *     "phone": "+919876543210",
 *     "partnerCode": "123456",
 *     "eventEnrollments": [],
 *     "createdAt": "2025-11-26T10:30:00.000Z",
 *     "updatedAt": "2025-11-26T10:30:00.000Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Missing or invalid required fields
 * - 409 Conflict: Phone number already exists
 * - 422 Validation Error: Schema validation failed
 * - 500 Internal Server Error: Partner creation failed
 *
 * @see {@link CashPartner} Cash Partner Schema
 */
router.post('/partner', createCashPartner);

/**
 * @route POST /api/web/cash/order
 * @group Cash Payment - Cash payment operations
 * @access Public (authenticated cash partners)
 *
 * @description
 * Creates a new cash payment order and generates tickets.
 * Supports single ticket purchase (buyer only) and multi-ticket purchase (buyer + others).
 * Unlike Razorpay, this endpoint processes immediate cash payments and generates tickets
 * without involving a payment gateway. No Payment record is created.
 *
 * Key Features:
 * - Validates cash partner by partner code
 * - Creates or finds existing users by phone number
 * - Generates unique order ID and payment ID (format: {partnerCode}_{timestamp})
 * - Creates event enrollment with all ticket holders
 * - Generates individual QR codes for each ticket
 * - Sends ticket emails to all ticket holders
 * - Updates event seat availability and ticket counts
 * - Links enrollment to cash partner record
 *
 * Generated IDs:
 * - orderId: `{partnerCode}_{timestamp}` (e.g., "123456_1732770678000")
 * - paymentId: `CASH_{partnerCode}_{timestamp}` (e.g., "CASH_123456_1732770678000")
 *
 * @handler {Function} createCashOrder - Controller function to create cash order
 *
 * @example
 * // Single Ticket Purchase (Default Pricing)
 * POST /api/web/cash/order
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "partnerCode": "123456",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "metadata": {
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     }
 *   }
 * }
 *
 * @example
 * // Single Ticket Purchase (With Pricing Tier)
 * POST /api/web/cash/order
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "partnerCode": "123456",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "priceTierId": "507f1f77bcf86cd799439099",
 *   "metadata": {
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     }
 *   }
 * }
 *
 * @example
 * // Multi-Ticket Purchase (Multiple Attendees)
 * POST /api/web/cash/order
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "partnerCode": "123456",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "priceTierId": "507f1f77bcf86cd799439099",
 *   "metadata": {
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     },
 *     "others": [
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
 *   "message": "Cash order processed successfully",
 *   "error": null,
 *   "data": {
 *     "orderId": "123456_1732770678000",
 *     "paymentId": "CASH_123456_1732770678000",
 *     "totalAmount": 4500,
 *     "ticketCount": 3,
 *     "eventName": "Tech Conference 2025",
 *     "eventId": "507f1f77bcf86cd799439011",
 *     "enrollmentId": "507f1f77bcf86cd799439022",
 *     "tierName": "Early Bird",
 *     "ticketHolders": [
 *       "john@example.com",
 *       "jane@example.com",
 *       "bob@example.com"
 *     ]
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Missing or invalid required fields
 * - 404 Not Found: Invalid partner code, event not found, or pricing tier not found
 * - 409 Conflict: User already enrolled in the event
 * - 500 Internal Server Error: Order processing failed
 *
 * @see {@link CashPartner} Cash Partner Schema
 * @see {@link EventEnrollment} Event Enrollment Schema
 * @see {@link Event} Event Schema
 */
router.post('/order', createCashOrder);

export default router;
