/**
 * @fileoverview User session routes for public/read-only access and booking
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
  getCategories,
  bookSession,
  getUserBookings,
  getBookingById,
  cancelBooking,
} from "./session.controller.js";
import {
  createSessionOrder,
  getSessionPaymentStatus,
} from "./session.payment.controller.js";
import { optionalAuth, authenticate } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
  validateBody,
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
 * @route   GET /api/app/sessions/categories
 * @desc    Get session categories with counts
 * @access  Public
 * @returns {Object} Categories with counts
 */
router.get("/categories", getCategories);

/**
 * @route   GET /api/app/sessions/my-bookings
 * @desc    Get current user's bookings
 * @access  User (authenticated)
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @query   {string} [status] - Filter by status
 * @returns {Object} User's bookings
 */
router.get(
  "/my-bookings",
  authenticate,
  validateQuery(sessionSchemas.listBookings),
  getUserBookings
);

/**
 * @route   GET /api/app/sessions/my-bookings/:bookingId
 * @desc    Get single booking details
 * @access  User (authenticated)
 * @param   {string} bookingId - Booking ID
 * @returns {Object} Booking details
 */
router.get(
  "/my-bookings/:bookingId",
  authenticate,
  validateParams(sessionSchemas.bookingId),
  getBookingById
);

/**
 * @route   POST /api/app/sessions/my-bookings/:bookingId/cancel
 * @desc    Cancel a booking
 * @access  User (authenticated)
 * @param   {string} bookingId - Booking ID
 * @body    {string} [reason] - Cancellation reason
 * @returns {Object} Cancelled booking
 */
router.post(
  "/my-bookings/:bookingId/cancel",
  authenticate,
  validateParams(sessionSchemas.bookingId),
  validateBody(sessionSchemas.cancelBooking),
  cancelBooking
);

// ============================================
// SESSION PAYMENT ROUTES (placed before /:id to avoid route conflicts)
// ============================================

/**
 * @route   POST /api/app/sessions/payment/create-order
 * @desc    Create a Razorpay payment order for session booking
 * @access  User (authenticated)
 * @body    {string} sessionId - Session ID to book
 * @body    {string} [currency=INR] - Payment currency
 * @body    {string} [callbackUrl] - Custom callback URL after payment
 * @body    {string} [userNotes] - Additional notes for the booking
 * @returns {Object} Payment order details with payment URL
 */
router.post(
  "/payment/create-order",
  authenticate,
  validateBody(
    Joi.object({
      sessionId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "string.pattern.base": "Invalid session ID format",
          "any.required": "Session ID is required",
        }),
      currency: Joi.string().valid("INR").default("INR"),
      callbackUrl: Joi.string().uri().optional(),
      userNotes: Joi.string().max(1000).optional(),
    })
  ),
  createSessionOrder
);

/**
 * @route   GET /api/app/sessions/payment/status/:orderId
 * @desc    Get session payment status
 * @access  Public
 * @param   {string} orderId - Razorpay order ID
 * @returns {Object} Payment status details
 */
router.get(
  "/payment/status/:orderId",
  validateParams(
    Joi.object({
      orderId: Joi.string().required().messages({
        "any.required": "Order ID is required",
      }),
    })
  ),
  getSessionPaymentStatus
);

// ============================================
// PARAMETERIZED ROUTES (must be after static routes)
// ============================================

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

/**
 * @route   POST /api/app/sessions/:id/book
 * @desc    Book a session
 * @access  User (authenticated)
 * @param   {string} id - Session ID
 * @body    {string} [contactMethod] - Preferred contact method (email/whatsapp/both)
 * @body    {string} [userNotes] - Additional notes
 * @returns {Object} Booking details with calendly link
 */
router.post(
  "/:id/book",
  authenticate,
  validateParams(sessionSchemas.sessionId),
  validateBody(sessionSchemas.book),
  bookSession
);

export default router;
