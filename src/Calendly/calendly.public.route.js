/**
 * @fileoverview Public routes for Calendly slots (no auth required)
 * @module routes/public/calendly
 */

import express from "express";
import Joi from "joi";
import axios from "axios";
import { getAvailableSlots } from "./calendly.controller.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import SessionBooking from "../../schema/SessionBooking.schema.js";

/**
 * Fetch scheduled event start time from Calendly API using invitee UUID.
 * Requires CALENDLY_PAT in .env. Falls back to current time if unavailable.
 */
const fetchScheduledTime = async (inviteeUuid) => {
  const pat = process.env.CALENDLY_PAT;
  if (!pat || !inviteeUuid) return null;
  try {
    const { data } = await axios.get(
      `https://api.calendly.com/event_invitees/${inviteeUuid}`,
      { headers: { Authorization: `Bearer ${pat}` }, timeout: 5000 }
    );
    const eventUri = data?.resource?.event;
    if (!eventUri) return null;
    // Fetch the scheduled event to get start_time
    const { data: eventData } = await axios.get(eventUri, {
      headers: { Authorization: `Bearer ${pat}` }, timeout: 5000,
    });
    return eventData?.resource?.start_time ? new Date(eventData.resource.start_time) : null;
  } catch (err) {
    console.warn("[CALENDLY-CALLBACK] Could not fetch scheduled time from API:", err.message);
    return null;
  }
};

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
router.get("/sos-scheduled", async (req, res) => {
  const { sosId, status, invitee_uuid } = req.query;

  console.log("[CALENDLY-CALLBACK] SOS scheduled callback received:", { sosId, status, invitee_uuid });

  const scheduledAt = (await fetchScheduledTime(invitee_uuid)) || new Date();

  const params = new URLSearchParams();
  if (sosId) params.set("sosId", sosId);
  if (status) params.set("status", status);
  params.set("scheduledAt", scheduledAt.toISOString());

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
router.get("/session-scheduled", async (req, res) => {
  const { bookingId, sessionId, invitee_uuid } = req.query;

  console.log("[CALENDLY-CALLBACK] Session scheduled callback received:", { bookingId, sessionId, invitee_uuid });

  // Try to get real scheduled time from Calendly API
  const scheduledAt = (await fetchScheduledTime(invitee_uuid)) || new Date();
  console.log("[CALENDLY-CALLBACK] Scheduled at:", scheduledAt, invitee_uuid ? "(from Calendly API)" : "(fallback: now)");

  // Immediately save to DB — don't rely solely on the app deep link
  if (bookingId) {
    try {
      const booking = await SessionBooking.findById(bookingId);
      if (booking && booking.status !== "scheduled") {
        booking.status = "scheduled";
        booking.scheduledSlot = scheduledAt;
        if (invitee_uuid) booking.calendlyEventUri = `https://api.calendly.com/event_invitees/${invitee_uuid}`;
        await booking.save();
        console.log("[CALENDLY-CALLBACK] ✓ Booking saved to DB:", bookingId, "→", scheduledAt);
      }
    } catch (err) {
      console.error("[CALENDLY-CALLBACK] Failed to save booking:", err.message);
    }
  }

  const params = new URLSearchParams();
  if (bookingId) params.set("bookingId", bookingId);
  if (sessionId) params.set("sessionId", sessionId);
  params.set("scheduledAt", scheduledAt.toISOString());

  const appDeepLink = `motivata://session/schedule-confirmed?${params.toString()}`;
  console.log("[CALENDLY-CALLBACK] Redirecting to:", appDeepLink);

  res.redirect(appDeepLink);
});

export default router;
