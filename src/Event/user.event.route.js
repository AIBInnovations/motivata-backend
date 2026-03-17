/**
 * @fileoverview User event routes for public/read-only access
 * @module routes/user/event
 */

import express from 'express';
import {
  getAllEvents,
  getEventById,
  getUpcomingEvents,
  getEventsByCategory,
  getEventTicketStats,
  getFeaturedEvents,
  saveEvent,
  unsaveEvent,
  getSavedEvents
} from './event.controller.js';
import { optionalAuth, authenticate } from '../../middleware/auth.middleware.js';
import { validateParams, validateQuery, eventSchemas, schemas } from '../../middleware/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

/**
 * @route   GET /api/app/events/saved
 * @desc    Get all saved events for the logged-in user
 * @access  Private (user auth required)
 */
router.get('/saved', authenticate, getSavedEvents);

/**
 * @route   POST /api/app/events/:id/save
 * @desc    Save an event
 * @access  Private (user auth required)
 */
router.post('/:id/save', authenticate, validateParams(eventSchemas.eventId), saveEvent);

/**
 * @route   DELETE /api/app/events/:id/save
 * @desc    Remove an event from saved list
 * @access  Private (user auth required)
 */
router.delete('/:id/save', authenticate, validateParams(eventSchemas.eventId), unsaveEvent);

/**
 * @route   GET /api/app/events
 * @desc    Get all live events with filters and pagination
 * @access  Public
 */
router.get(
  '/',
  optionalAuth,
  validateQuery(eventSchemas.list),
  async (req, res, next) => {
    // Force isLive to be true for public access
    req.query.isLive = true;
    next();
  },
  getAllEvents
);

/**
 * @route   GET /api/app/events/upcoming
 * @desc    Get upcoming events
 * @access  Public
 */
router.get(
  '/upcoming',
  optionalAuth,
  validateQuery(Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
  })),
  getUpcomingEvents
);

/**
 * @route   GET /api/app/events/featured
 * @desc    Get all featured events (live only)
 * @access  Public
 */
router.get(
  '/featured',
  optionalAuth,
  validateQuery(Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
  })),
  getFeaturedEvents
);

/**
 * @route   GET /api/app/events/category/:category
 * @desc    Get events by category
 * @access  Public
 */
router.get(
  '/category/:category',
  optionalAuth,
  validateParams(Joi.object({
    category: Joi.string().valid(
      'TECHNOLOGY', 'EDUCATION', 'MEDICAL', 'COMEDY', 'ENTERTAINMENT',
      'BUSINESS', 'SPORTS', 'ARTS', 'MUSIC', 'FOOD', 'LIFESTYLE', 'OTHER'
    ).required()
  })),
  validateQuery(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })),
  getEventsByCategory
);

/**
 * @route   GET /api/app/events/:id/ticket-stats
 * @desc    Get event ticket statistics
 * @access  Public
 */
router.get(
  '/:id/ticket-stats',
  validateParams(eventSchemas.eventId),
  getEventTicketStats
);

/**
 * @route   GET /api/app/events/:id
 * @desc    Get single event by ID
 * @access  Public
 */
router.get(
  '/:id',
  optionalAuth,
  validateParams(eventSchemas.eventId),
  getEventById
);

export default router;