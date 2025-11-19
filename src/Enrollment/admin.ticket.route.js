/**
 * @fileoverview Admin ticket routes for QR code verification
 * @module routes/admin/ticket
 */

import express from 'express';
import {
  verifyTicket
} from './ticket.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/tickets/verify
 * @desc    Verify QR code ticket (for management staff at event)
 * @access  Admin/Staff
 * @query   token - JWT token from QR code
 */
router.get(
  '/verify',
  verifyTicket
);

export default router;
