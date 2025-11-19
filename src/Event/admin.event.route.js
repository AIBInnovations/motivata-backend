/**
 * @fileoverview Admin event routes with full CRUD operations
 * @module routes/admin/event
 */

import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  restoreEvent,
  getDeletedEvents,
  permanentDeleteEvent,
  updateExpiredEvents
} from './event.controller.js';
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, eventSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/events
 * @desc    Create a new event
 * @access  Admin
 */
router.post(
  '/',
  validateBody(eventSchemas.create),
  createEvent
);

/**
 * @route   GET /api/web/events
 * @desc    Get all events with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  validateQuery(eventSchemas.list),
  getAllEvents
);

/**
 * @route   GET /api/web/events/deleted
 * @desc    Get all soft deleted events
 * @access  Admin
 */
router.get(
  '/deleted',
  validateQuery(eventSchemas.list),
  getDeletedEvents
);

/**
 * @route   POST /api/web/events/update-expired
 * @desc    Update all expired events status
 * @access  Admin
 */
router.post(
  '/update-expired',
  updateExpiredEvents
);

/**
 * @route   GET /api/web/events/:id
 * @desc    Get single event by ID
 * @access  Admin
 */
router.get(
  '/:id',
  validateParams(eventSchemas.eventId),
  getEventById
);

/**
 * @route   PUT /api/web/events/:id
 * @desc    Update event
 * @access  Admin
 */
router.put(
  '/:id',
  validateParams(eventSchemas.eventId),
  validateBody(eventSchemas.update),
  updateEvent
);

/**
 * @route   DELETE /api/web/events/:id
 * @desc    Soft delete event
 * @access  Admin
 */
router.delete(
  '/:id',
  validateParams(eventSchemas.eventId),
  deleteEvent
);

/**
 * @route   POST /api/web/events/:id/restore
 * @desc    Restore soft deleted event
 * @access  Admin
 */
router.post(
  '/:id/restore',
  validateParams(eventSchemas.eventId),
  restoreEvent
);

/**
 * @route   DELETE /api/web/events/:id/permanent
 * @desc    Permanently delete event (cannot be undone)
 * @access  Super Admin only
 */
router.delete(
  '/:id/permanent',
  isSuperAdmin,
  validateParams(eventSchemas.eventId),
  permanentDeleteEvent
);

export default router;