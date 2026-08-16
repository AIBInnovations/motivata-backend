/**
 * @fileoverview Event Request admin routes
 * Handles admin operations for invite-only event registration requests
 * @module routes/eventRequest/admin
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  eventRequestSchemas
} from '../../middleware/validation.middleware.js';
import {
  getAllEventRequests,
  getEventRequestById,
  approveEventRequest,
  rejectEventRequest,
  getEventRequestStats,
  getPendingCount
} from './eventRequest.admin.controller.js';

const router = express.Router();

/**
 * All routes require authentication + admin role
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/event-requests/admin/stats
 * @desc    Get event invite request statistics (optionally filtered by eventId)
 * @access  Admin
 */
router.get('/stats', getEventRequestStats);

/**
 * @route   GET /api/web/event-requests/admin/pending-count
 * @desc    Get total pending invite requests count across all events
 * @access  Admin
 */
router.get('/pending-count', getPendingCount);

/**
 * @route   GET /api/web/event-requests/admin/requests
 * @desc    Get all event invite requests with filters (status, search, eventId)
 * @access  Admin
 */
router.get(
  '/requests',
  validateQuery(eventRequestSchemas.list),
  getAllEventRequests
);

/**
 * @route   GET /api/web/event-requests/admin/requests/:id
 * @desc    Get single event invite request by ID
 * @access  Admin
 */
router.get(
  '/requests/:id',
  validateParams(eventRequestSchemas.requestId),
  getEventRequestById
);

/**
 * @route   POST /api/web/event-requests/admin/requests/:id/approve
 * @desc    Approve an event invite request
 * @access  Admin
 */
router.post(
  '/requests/:id/approve',
  validateParams(eventRequestSchemas.requestId),
  validateBody(eventRequestSchemas.approve),
  approveEventRequest
);

/**
 * @route   POST /api/web/event-requests/admin/requests/:id/reject
 * @desc    Reject an event invite request
 * @access  Admin
 */
router.post(
  '/requests/:id/reject',
  validateParams(eventRequestSchemas.requestId),
  validateBody(eventRequestSchemas.reject),
  rejectEventRequest
);

export default router;
