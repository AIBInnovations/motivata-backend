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
import { authenticate } from '../../middleware/auth.middleware.js';

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
