/**
 * @fileoverview Public routes for Calendly slots (no auth required)
 * @module routes/public/calendly
 */

import express from "express";
import Joi from "joi";
import axios from "axios";
import crypto from "crypto";
import { getAvailableSlots } from "./calendly.controller.js";
import { optionalAuth, authenticate } from "../../middleware/auth.middleware.js";
import User from "../../schema/User.schema.js";
import {
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import SessionBooking from "../../schema/SessionBooking.schema.js";
import UserSOSProgress from "../Quiz/schemas/userSOSProgress.schema.js";

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

/**
 * @route   POST /api/app/calendly/sync-my-bookings
 * @desc    Triggered by the app on SOS/Profile page load.
 *          Checks Calendly for any events matching the user's unscheduled bookings
 *          and updates scheduledSlot + status immediately.
 * @access  Authenticated user
 */
router.post("/sync-my-bookings", authenticate, async (req, res) => {
  const pat = process.env.CALENDLY_PAT;
  if (!pat) return res.status(200).json({ synced: 0 });

  const userId = req.user.id;

  try {
    // 1. Find this user's unscheduled confirmed bookings
    const unscheduled = await SessionBooking.find({
      userId,
      status: { $in: ["confirmed", "pending"] },
      paymentStatus: { $in: ["paid", "free"] },
      scheduledSlot: { $exists: false },
    }).lean();

    if (unscheduled.length === 0) {
      return res.status(200).json({ synced: 0, message: "No unscheduled bookings" });
    }

    const bookingById = new Map(unscheduled.map(b => [b._id.toString(), b]));

    // 2. Get user email for fallback matching
    const user = await User.findById(userId, "email").lean();
    const userEmail = user?.email?.toLowerCase();

    // 3. Fetch active Calendly events (7 days back → 90 days forward)
    const apiHeaders = { Authorization: `Bearer ${pat}` };
    const { data: me } = await axios.get("https://api.calendly.com/users/me", { headers: apiHeaders, timeout: 8000 });
    const orgUri = me.resource.current_organization;

    const params = new URLSearchParams({
      organization: orgUri,
      status: "active",
      sort: "start_time:asc",
      count: "100",
      min_start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_start_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const { data: eventsData } = await axios.get(
      `https://api.calendly.com/scheduled_events?${params}`,
      { headers: apiHeaders, timeout: 10000 }
    );
    const events = eventsData.collection || [];

    let synced = 0;

    for (const event of events) {
      const startTime = new Date(event.start_time);
      const uuid = event.uri.split("/").pop();

      let invitees;
      try {
        const { data: inv } = await axios.get(
          `https://api.calendly.com/scheduled_events/${uuid}/invitees`,
          { headers: apiHeaders, timeout: 8000 }
        );
        invitees = inv.collection || [];
      } catch {
        continue;
      }

      for (const invitee of invitees) {
        const utmContent = invitee.tracking?.utm_content;
        const inviteeEmail = invitee.email?.toLowerCase();
        const inviteeUri = invitee.uri;

        let bookingId = null;

        // Primary: utm_content = bookingId
        if (utmContent && bookingById.has(utmContent)) {
          bookingId = utmContent;
        }
        // Fallback: invitee email matches this user
        else if (userEmail && inviteeEmail === userEmail && bookingById.size > 0) {
          bookingId = [...bookingById.keys()][0]; // most recent
        }

        if (!bookingId) continue;

        await SessionBooking.findByIdAndUpdate(bookingId, {
          status: "scheduled",
          scheduledSlot: startTime,
          ...(inviteeUri && { calendlyEventUri: inviteeUri }),
        });

        bookingById.delete(bookingId);
        synced++;

        console.log(`[CALENDLY-SYNC-USER] ✓ Booking ${bookingId} scheduled at ${startTime.toISOString()} for user ${userId}`);
      }

      if (bookingById.size === 0) break; // all matched
    }

    return res.status(200).json({ synced });
  } catch (err) {
    console.error("[CALENDLY-SYNC-USER] Error:", err.message);
    return res.status(200).json({ synced: 0, error: err.message });
  }
});

/**
 * @route   POST /api/app/calendly/webhook
 * @desc    Calendly webhook receiver for invitee.created / invitee.canceled events
 *          utm_content = bookingId (session booking) or sosId (SOS program)
 * @access  Public (verified by signing key if set)
 */
router.post("/webhook", express.json({ type: "*/*" }), async (req, res) => {
  try {
    // Verify Calendly webhook signature if signing key is configured
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (signingKey) {
      const signature = req.headers["calendly-webhook-signature"];
      if (!signature) {
        console.warn("[CALENDLY-WEBHOOK] Missing signature header");
        return res.status(401).json({ error: "Missing signature" });
      }
      // Calendly signature: t=timestamp,v1=hmac_sha256(timestamp + "." + body)
      const parts = {};
      signature.split(",").forEach(part => {
        const [k, v] = part.split("=");
        parts[k] = v;
      });
      const toSign = `${parts.t}.${JSON.stringify(req.body)}`;
      const expected = crypto.createHmac("sha256", signingKey).update(toSign).digest("hex");
      if (expected !== parts.v1) {
        console.warn("[CALENDLY-WEBHOOK] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    console.log("[CALENDLY-WEBHOOK] Received event:", event);

    // Only handle invitee.created (new booking)
    if (event !== "invitee.created") {
      return res.status(200).json({ received: true });
    }

    const utmContent = payload?.tracking?.utm_content;
    const startTime = payload?.event?.start_time || payload?.scheduled_event?.start_time;
    const inviteeUri = payload?.invitee?.uri || "";

    console.log("[CALENDLY-WEBHOOK] utm_content:", utmContent, "| start_time:", startTime);

    if (!utmContent || !startTime) {
      console.warn("[CALENDLY-WEBHOOK] Missing utm_content or start_time — cannot match booking");
      return res.status(200).json({ received: true });
    }

    const scheduledAt = new Date(startTime);

    // Try session booking first
    const sessionBooking = await SessionBooking.findById(utmContent).catch(() => null);
    if (sessionBooking) {
      if (sessionBooking.status !== "scheduled") {
        sessionBooking.status = "scheduled";
        sessionBooking.scheduledSlot = scheduledAt;
        if (inviteeUri) sessionBooking.calendlyEventUri = inviteeUri;
        await sessionBooking.save();
        console.log("[CALENDLY-WEBHOOK] ✓ Session booking updated:", utmContent, "→", scheduledAt);
      } else {
        console.log("[CALENDLY-WEBHOOK] Session booking already scheduled:", utmContent);
      }
      return res.status(200).json({ received: true });
    }

    // Try SOS progress record
    const mongoose = (await import("mongoose")).default;
    if (mongoose.Types.ObjectId.isValid(utmContent)) {
      const sosProgress = await UserSOSProgress.findById(utmContent).catch(() => null);
      if (sosProgress) {
        sosProgress.scheduledAt = scheduledAt;
        if (inviteeUri) sosProgress.calendlyInviteeUri = inviteeUri;
        await sosProgress.save();
        console.log("[CALENDLY-WEBHOOK] ✓ SOS progress updated:", utmContent, "→", scheduledAt);
        return res.status(200).json({ received: true });
      }
    }

    console.warn("[CALENDLY-WEBHOOK] No matching booking found for utm_content:", utmContent);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[CALENDLY-WEBHOOK] Error:", err.message);
    // Always return 200 to Calendly so it doesn't retry indefinitely
    return res.status(200).json({ received: true, error: err.message });
  }
});

export default router;
