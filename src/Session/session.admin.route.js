/**
 * @fileoverview Admin session routes with full CRUD operations
 * @module routes/admin/session
 */

import express from "express";
import {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  restoreSession,
  getDeletedSessions,
  permanentDeleteSession,
  getSessionBookingStats,
  toggleSessionLiveStatus,
  getSessionsForDropdown,
} from "./session.controller.js";
import {
  authenticate,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  sessionSchemas,
} from "../../middleware/validation.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/sessions
 * @desc    Create a new session
 * @access  Admin
 * @body    {Object} Session data
 * @body    {string} title - Session title (required)
 * @body    {string} shortDescription - Brief description (required)
 * @body    {string} longDescription - Detailed description (required)
 * @body    {number} price - Session price (required)
 * @body    {number} [compareAtPrice] - Original price for comparison
 * @body    {number} duration - Session duration in minutes (required)
 * @body    {string} sessionType - Session type: OTO or OTM (required)
 * @body    {string} host - Host name (required)
 * @body    {number} [availableSlots] - Available booking slots
 * @body    {string} [calendlyLink] - Calendly booking link
 * @body    {Date} [sessionDate] - Session date
 * @body    {string} [imageUrl] - Session image URL
 * @returns {Object} Created session
 */
router.post("/", validateBody(sessionSchemas.create), createSession);

/**
 * @route   GET /api/web/sessions
 * @desc    Get all sessions with filters and pagination
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page (max 100)
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order (asc/desc)
 * @query   {string} [sessionType] - Filter by session type (OTO/OTM)
 * @query   {boolean} [isLive] - Filter by live status
 * @query   {string} [host] - Filter by host name
 * @query   {number} [minPrice] - Minimum price filter
 * @query   {number} [maxPrice] - Maximum price filter
 * @query   {string} [search] - Search in title and descriptions
 * @returns {Object} Paginated list of sessions
 */
router.get("/", validateQuery(sessionSchemas.list), getAllSessions);

/**
 * @route   GET /api/web/sessions/deleted
 * @desc    Get all soft deleted sessions
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @returns {Object} Paginated list of deleted sessions
 */
router.get(
  "/deleted",
  validateQuery(sessionSchemas.list),
  getDeletedSessions
);

/**
 * @route   GET /api/web/sessions/dropdown
 * @desc    Get all sessions for dropdown (lightweight - _id, title, host, etc.)
 * @access  Admin
 * @query   {boolean} [isLive] - Filter by live status
 * @query   {string} [sessionType] - Filter by session type
 * @query   {string} [search] - Search by session title
 * @returns {Object} List of sessions for dropdown
 */
router.get("/dropdown", getSessionsForDropdown);

/**
 * @route   GET /api/web/sessions/:id/booking-stats
 * @desc    Get session booking statistics
 * @access  Admin
 * @param   {string} id - Session ID
 * @returns {Object} Session booking statistics
 */
router.get(
  "/:id/booking-stats",
  validateParams(sessionSchemas.sessionId),
  getSessionBookingStats
);

/**
 * @route   POST /api/web/sessions/:id/toggle-live
 * @desc    Toggle session live status (activate/deactivate)
 * @access  Admin
 * @param   {string} id - Session ID
 * @returns {Object} Updated session
 */
router.post(
  "/:id/toggle-live",
  validateParams(sessionSchemas.sessionId),
  toggleSessionLiveStatus
);

/**
 * @route   GET /api/web/sessions/:id
 * @desc    Get single session by ID
 * @access  Admin
 * @param   {string} id - Session ID
 * @returns {Object} Session details
 */
router.get(
  "/:id",
  validateParams(sessionSchemas.sessionId),
  getSessionById
);

/**
 * @route   PUT /api/web/sessions/:id
 * @desc    Update session
 * @access  Admin
 * @param   {string} id - Session ID
 * @body    {Object} Updated session data
 * @returns {Object} Updated session
 */
router.put(
  "/:id",
  validateParams(sessionSchemas.sessionId),
  validateBody(sessionSchemas.update),
  updateSession
);

/**
 * @route   DELETE /api/web/sessions/:id
 * @desc    Soft delete session
 * @access  Admin
 * @param   {string} id - Session ID
 * @returns {Object} Success message
 */
router.delete(
  "/:id",
  validateParams(sessionSchemas.sessionId),
  deleteSession
);

/**
 * @route   POST /api/web/sessions/:id/restore
 * @desc    Restore soft deleted session
 * @access  Admin
 * @param   {string} id - Session ID
 * @returns {Object} Restored session
 */
router.post(
  "/:id/restore",
  validateParams(sessionSchemas.sessionId),
  restoreSession
);

/**
 * @route   DELETE /api/web/sessions/:id/permanent
 * @desc    Permanently delete session (cannot be undone)
 * @access  Super Admin only
 * @param   {string} id - Session ID
 * @returns {Object} Success message
 */
router.delete(
  "/:id/permanent",
  isSuperAdmin,
  validateParams(sessionSchemas.sessionId),
  permanentDeleteSession
);

export default router;
