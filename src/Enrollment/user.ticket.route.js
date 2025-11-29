/**
 * @fileoverview User ticket routes for QR code generation
 * @module routes/user/ticket
 */

import express from 'express';
import {
  generateTicketToken,
  generateQRCode,
  generateMockQRLink,
  scanQRCode
} from './ticket.controller.js';
import {
  validateRedemptionLink,
  redeemTickets,
  scanCashTicket,
} from '../cash/offlineCash.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateQuery,
  offlineCashSchemas,
} from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/app/tickets/mock/qr
 * @desc    Generate mock QR scan link for testing
 * @access  Public (no auth)
 */
router.get('/mock/qr', generateMockQRLink);

/**
 * @route   GET /api/app/tickets/qr-scan
 * @desc    Scan QR code and fetch enrollment details
 * @access  Public (no auth)
 */
router.get('/qr-scan', scanQRCode);

/**
 * @route   GET /api/app/tickets/redeem
 * @desc    Validate redemption link and get form data
 * @access  Public (no auth)
 */
router.get(
  '/redeem',
  validateQuery(offlineCashSchemas.validateLink),
  validateRedemptionLink
);

/**
 * @route   POST /api/app/tickets/redeem
 * @desc    Submit redemption form and create enrollments
 * @access  Public (no auth)
 */
router.post(
  '/redeem',
  validateBody(offlineCashSchemas.redeem),
  redeemTickets
);

/**
 * @route   GET /api/app/tickets/cash/qr-scan
 * @desc    Scan cash ticket QR code
 * @access  Public (no auth)
 */
router.get(
  '/cash/qr-scan',
  validateQuery(offlineCashSchemas.scanTicket),
  scanCashTicket
);

/**
 * All routes below require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/app/tickets/:enrollmentId/token
 * @desc    Generate JWT token for ticket
 * @access  Authenticated User
 */
router.get(
  '/:enrollmentId/token',
  generateTicketToken
);

/**
 * @route   GET /api/app/tickets/:enrollmentId/qr/:phone
 * @desc    Generate and download QR code PNG for specific ticket
 * @access  Authenticated User
 */
router.get(
  '/:enrollmentId/qr/:phone',
  generateQRCode
);

export default router;
