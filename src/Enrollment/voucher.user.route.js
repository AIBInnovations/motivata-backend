/**
 * @fileoverview User voucher routes
 * @module routes/user/voucher
 */

import express from 'express';
import { checkAvailability } from './voucher.controller.js';
import { validateBody, voucherSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/app/vouchers/check-availability
 * @desc    Check voucher availability and claim it
 * @access  Public
 *
 * @body {string} code - Voucher code to check
 * @body {string[]} phones - Array of phone numbers to claim voucher for
 * @body {string} [eventId] - Optional event ID for event-specific vouchers
 *
 * @returns {Object} Response with voucher availability status
 *
 * @example
 * // Request
 * POST /api/app/vouchers/check-availability
 * {
 *   "code": "FESTIVAL200",
 *   "phones": ["9876543210", "9876543211"]
 * }
 *
 * // Success Response (200)
 * {
 *   "status": 200,
 *   "message": "The voucher is available! Claimed successfully.",
 *   "error": null,
 *   "data": {
 *     "voucher": {
 *       "id": "...",
 *       "code": "FESTIVAL200",
 *       "title": "Festival Food Court Discount",
 *       "description": "Get Rs.200 off at the food court"
 *     },
 *     "claimedFor": ["9876543210", "9876543211"],
 *     "remainingSlots": 1498
 *   }
 * }
 *
 * // Error Response - Voucher exhausted (400)
 * {
 *   "status": 400,
 *   "message": "Unlucky, we ran out of vouchers!",
 *   "error": { "availableSlots": 0, "requiredSlots": 2 },
 *   "data": null
 * }
 */
router.post(
  '/check-availability',
  validateBody(voucherSchemas.checkAvailability),
  checkAvailability
);

export default router;
