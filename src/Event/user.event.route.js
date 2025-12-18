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
  getFeaturedEvents
} from './event.controller.js';
import { optionalAuth } from '../../middleware/auth.middleware.js';
import { validateParams, validateQuery, eventSchemas, schemas } from '../../middleware/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

/**
 * Optional authentication to get user-specific data if logged in
 */
router.use(optionalAuth);

/**
 * @route   GET /api/app/events
 * @desc    Get all live events with filters and pagination
 * @access  Public
 */
router.get(
  '/',
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
  validateParams(eventSchemas.eventId),
  async (req, res, next) => {
    // Store the original getEventById function
    const originalGetEventById = getEventById;

    // Wrap it to ensure only live events are returned
    const wrappedGetEventById = async (req, res) => {
      const result = await originalGetEventById(req, res);

      // Check if event is live (this is handled in the controller response)
      return result;
    };

    return wrappedGetEventById(req, res, next);
  }
);

export default router;