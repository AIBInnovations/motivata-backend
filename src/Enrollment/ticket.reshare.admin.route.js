/**
 * @fileoverview Admin ticket reshare routes
 * Allows admins to view ticket holders and reshare tickets
 * @module routes/admin/ticketReshare
 */

import express from 'express';
import {
  getTicketHolders,
  reshareTicket,
  bulkReshareTickets
} from './ticket.reshare.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateParams,
  validateQuery,
  validateBody
} from '../../middleware/validation.middleware.js';
import { ticketReshareSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/tickets/reshare/list/:eventId
 * @desc    Get all ticket holders for an event (both online and cash)
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   search - Search by phone, name, or email
 * @query   enrollmentType - Filter by type: 'ONLINE' or 'CASH'
 * @query   scannedStatus - Filter by scanned status: 'true' or 'false'
 */
router.get(
  '/list/:eventId',
  validateParams(ticketReshareSchemas.eventId),
  validateQuery(ticketReshareSchemas.listQuery),
  getTicketHolders
);

/**
 * @route   POST /api/web/tickets/reshare/:enrollmentType/:enrollmentId
 * @desc    Reshare a single ticket - reset scan fields and resend QR
 * @access  Admin
 * @param   enrollmentType - 'ONLINE' or 'CASH'
 * @param   enrollmentId - Enrollment ID
 * @body    phone - Phone number (required for ONLINE enrollments)
 * @body    sendVia - Notification method: 'whatsapp', 'email', or 'both' (default: 'both')
 */
router.post(
  '/:enrollmentType/:enrollmentId',
  validateParams(ticketReshareSchemas.reshareParams),
  validateBody(ticketReshareSchemas.reshareBody),
  reshareTicket
);

/**
 * @route   POST /api/web/tickets/reshare/bulk
 * @desc    Bulk reshare multiple tickets
 * @access  Admin
 * @body    tickets - Array of { enrollmentType, enrollmentId, phone? }
 * @body    sendVia - Notification method: 'whatsapp', 'email', or 'both' (default: 'whatsapp')
 */
router.post(
  '/bulk',
  validateBody(ticketReshareSchemas.bulkReshare),
  bulkReshareTickets
);

export default router;
