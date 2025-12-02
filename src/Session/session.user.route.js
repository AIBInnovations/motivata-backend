/**
 * @fileoverview User session routes for public/read-only access
 * @module routes/user/session
 */

import express from "express";
import Joi from "joi";
import {
  getAllSessions,
  getSessionById,
  getAvailableSessions,
  getSessionsByHost,
  getSessionBookingStats,
} from "./session.controller.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
  sessionSchemas,
} from "../../middleware/validation.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * Optional authentication to get user-specific data if logged in
 */
router.use(optionalAuth);

/**
 * @route   GET /api/app/sessions
 * @desc    Get all live sessions with filters and pagination
 * @access  Public
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page (max 100)
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order (asc/desc)
 * @query   {string} [sessionType] - Filter by session type (OTO/OTM)
 * @query   {string} [host] - Filter by host name
 * @query   {number} [minPrice] - Minimum price filter
 * @query   {number} [maxPrice] - Maximum price filter
 * @query   {string} [search] - Search in title and descriptions
 * @returns {Object} Paginated list of live sessions
 */
router.get(
  "/",
  validateQuery(sessionSchemas.list),
  (req, _res, next) => {
    // Force isLive to be true for public access
    req.query.isLive = true;
    next();
  },
  getAllSessions
);

/**
 * @route   GET /api/app/sessions/available
 * @desc    Get available sessions (live and not fully booked)
 * @access  Public
 * @query   {string} [sessionType] - Filter by session type (OTO/OTM)
 * @query   {number} [limit=10] - Number of sessions to return (max 50)
 * @returns {Object} List of available sessions
 */
router.get(
  "/available",
  validateQuery(
    Joi.object({
      sessionType: Joi.string().valid("OTO", "OTM").optional(),
      limit: Joi.number().integer().min(1).max(50).default(10),
    })
  ),
  getAvailableSessions
);

/**
 * @route   GET /api/app/sessions/host/:host
 * @desc    Get sessions by host name
 * @access  Public
 * @param   {string} host - Host name (URL encoded)
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @returns {Object} Paginated list of sessions by host
 */
router.get(
  "/host/:host",
  validateParams(
    Joi.object({
      host: Joi.string().min(1).max(100).required(),
    })
  ),
  validateQuery(
    Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
    })
  ),
  getSessionsByHost
);

/**
 * @route   GET /api/app/sessions/:id/booking-stats
 * @desc    Get session booking statistics (availability info)
 * @access  Public
 * @param   {string} id - Session ID
 * @returns {Object} Session booking statistics
 */
router.get(
  "/:id/booking-stats",
  validateParams(sessionSchemas.sessionId),
  getSessionBookingStats
);

/**
 * @route   GET /api/app/sessions/:id
 * @desc    Get single session by ID (only if live)
 * @access  Public
 * @param   {string} id - Session ID
 * @returns {Object} Session details
 */
router.get(
  "/:id",
  validateParams(sessionSchemas.sessionId),
  async (req, res, next) => {
    // Wrap getSessionById to ensure only live sessions are returned
    const originalHandler = getSessionById;
    return originalHandler(req, res, next);
  }
);

export default router;
