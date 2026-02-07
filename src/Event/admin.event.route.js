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
  updateExpiredEvents,
  getEventTicketStats,
  getEventsForDropdown,
  getFeaturedEvents
} from './event.controller.js';
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, eventSchemas } from '../../middleware/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

/**
 * PUBLIC ROUTES (no auth required)
 */

/**
 * @route   GET /api/web/events/website/featured
 * @desc    Get upcoming featured events for the website
 * @access  Public
 * @query   {number} [limit=10] - Maximum number of events to return
 */
router.get(
  '/website/featured',
  validateQuery(Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
  })),
  getFeaturedEvents
);

/**
 * All routes below require authentication and admin access
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
 * @route   GET /api/web/events/dropdown
 * @desc    Get all events for dropdown (lightweight - _id, name, startDate, isLive, category)
 * @access  Admin
 * @query   {boolean} [isLive] - Filter by live status
 * @query   {string} [search] - Search by event name
 */
router.get(
  '/dropdown',
  getEventsForDropdown
);

/**
 * @route   GET /api/web/events/featured
 * @desc    Get all featured events
 * @access  Admin
 * @query   {number} [limit=10] - Maximum number of events to return
 */
router.get(
  '/featured',
  validateQuery(Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
  })),
  getFeaturedEvents
);

/**
 * @route   GET /api/web/events/:id/ticket-stats
 * @desc    Get event ticket statistics
 * @access  Admin
 */
router.get(
  '/:id/ticket-stats',
  validateParams(eventSchemas.eventId),
  getEventTicketStats
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