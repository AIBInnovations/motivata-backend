/**
 * @fileoverview Public routes for Calendly slots (no auth required)
 * @module routes/public/calendly
 */

import express from "express";
import Joi from "joi";
import { getAvailableSlots } from "./calendly.controller.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * Optional authentication - allows both authenticated and unauthenticated access
 */
router.use(optionalAuth);

/**
 * @route   GET /api/app/calendly/slots/:eventTypeUri
 * @desc    Get available time slots for an event type
 * @access  Public (no auth required)
 * @param   {string} eventTypeUri - URI-encoded Calendly event type URI
 * @query   {string} [start_date] - Start date (YYYY-MM-DD), defaults to today
 * @query   {string} [end_date] - End date (YYYY-MM-DD), defaults to 30 days from start
 * @returns {Object} Available slots
 */
router.get(
  "/slots/:eventTypeUri",
  validateParams(
    Joi.object({
      eventTypeUri: Joi.string().required().messages({
        "any.required": "Event type URI is required",
      }),
    })
  ),
  validateQuery(
    Joi.object({
      start_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .messages({
          "string.pattern.base": "start_date must be in YYYY-MM-DD format",
        }),
      end_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .messages({
          "string.pattern.base": "end_date must be in YYYY-MM-DD format",
        }),
    })
  ),
  getAvailableSlots
);

/**
 * @route   GET /api/app/calendly/sos-scheduled
 * @desc    Calendly redirect callback after SOS session is scheduled
 *          Redirects user back to the motivata app with confirmation
 * @access  Public
 * @query   {string} sosId - SOS Program ID
 * @query   {string} [status] - Scheduling status from Calendly
 */
router.get("/sos-scheduled", (req, res) => {
  const { sosId, status } = req.query;

  console.log("[CALENDLY-CALLBACK] SOS scheduled callback received:", { sosId, status });

  const params = new URLSearchParams();
  if (sosId) params.set("sosId", sosId);
  if (status) params.set("status", status);
  params.set("scheduledAt", new Date().toISOString());

  const appDeepLink = `motivata://sos/schedule-confirmed?${params.toString()}`;
  console.log("[CALENDLY-CALLBACK] Redirecting to:", appDeepLink);

  res.redirect(appDeepLink);
});

/**
 * @route   GET /api/app/calendly/session-scheduled
 * @desc    Calendly redirect callback after session scheduling
 *          Redirects user back to app with booking confirmation
 * @access  Public
 * @query   {string} bookingId - Session Booking ID
 * @query   {string} [sessionId] - Session ID
 */
router.get("/session-scheduled", (req, res) => {
  const { bookingId, sessionId } = req.query;

  console.log("[CALENDLY-CALLBACK] Session scheduled callback received:", { bookingId, sessionId });

  const params = new URLSearchParams();
  if (bookingId) params.set("bookingId", bookingId);
  if (sessionId) params.set("sessionId", sessionId);
  params.set("scheduledAt", new Date().toISOString());

  const appDeepLink = `motivata://session/schedule-confirmed?${params.toString()}`;
  console.log("[CALENDLY-CALLBACK] Redirecting to:", appDeepLink);

  res.redirect(appDeepLink);
});

export default router;
