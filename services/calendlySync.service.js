/**
 * @fileoverview Calendly Sync Service
 * Polls Calendly's API every 5 minutes.
 * Strategy:
 *   1. Find all SessionBookings that are confirmed+paid but not yet scheduled
 *   2. Fetch all active Calendly events in a 90-day window
 *   3. For each event's invitees, match by utm_content (bookingId) or invitee email → User
 *   4. Update matched bookings with scheduledSlot + status=scheduled
 *
 * Works on Calendly free plan — no webhooks needed.
 */

import cron from "node-cron";
import axios from "axios";
import SessionBooking from "../schema/SessionBooking.schema.js";
import User from "../schema/User.schema.js";

const PAT = process.env.CALENDLY_PAT;
const CALENDLY_API = "https://api.calendly.com";
const POLL_INTERVAL_MINUTES = 5;

const apiHeaders = () => ({ Authorization: `Bearer ${PAT}` });

/**
 * Get Calendly org URI for this PAT
 */
const getOrgUri = async () => {
  const { data } = await axios.get(`${CALENDLY_API}/users/me`, {
    headers: apiHeaders(),
    timeout: 10000,
  });
  return data.resource.current_organization;
};

/**
 * Fetch all active Calendly events from now to +90 days
 */
const fetchActiveEvents = async (orgUri) => {
  const minStartTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days back
  const maxStartTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days forward

  const params = new URLSearchParams({
    organization: orgUri,
    status: "active",
    sort: "start_time:asc",
    count: "100",
    min_start_time: minStartTime.toISOString(),
    max_start_time: maxStartTime.toISOString(),
  });

  const { data } = await axios.get(`${CALENDLY_API}/scheduled_events?${params}`, {
    headers: apiHeaders(),
    timeout: 10000,
  });
  return data.collection || [];
};

/**
 * Fetch invitees for a Calendly event URI
 */
const fetchInvitees = async (eventUri) => {
  const uuid = eventUri.split("/").pop();
  const { data } = await axios.get(
    `${CALENDLY_API}/scheduled_events/${uuid}/invitees`,
    { headers: apiHeaders(), timeout: 10000 }
  );
  return data.collection || [];
};

/**
 * Main sync — find unscheduled bookings and match against Calendly events
 */
const syncCalendlyBookings = async () => {
  if (!PAT) return;

  try {
    console.log("[CALENDLY-SYNC] Starting sync cycle");

    // 1. Get all unscheduled confirmed+paid bookings
    const unscheduledBookings = await SessionBooking.find({
      status: { $in: ["confirmed", "pending"] },
      paymentStatus: { $in: ["paid", "free"] },
      scheduledSlot: { $exists: false },
    }).lean();

    if (unscheduledBookings.length === 0) {
      console.log("[CALENDLY-SYNC] No unscheduled bookings — nothing to do");
      return;
    }

    console.log(`[CALENDLY-SYNC] ${unscheduledBookings.length} unscheduled booking(s) to check`);

    // Build lookup maps for fast matching
    // Map: bookingId (string) → booking
    const bookingById = new Map(unscheduledBookings.map(b => [b._id.toString(), b]));

    // Map: userId (string) → booking (for email fallback)
    const bookingByUserId = new Map(unscheduledBookings.map(b => [b.userId.toString(), b]));

    // Get user emails for email-based matching
    const userIds = unscheduledBookings.map(b => b.userId);
    const users = await User.find({ _id: { $in: userIds } }, "email phone").lean();
    // Map: email (lowercase) → userId
    const userIdByEmail = new Map(
      users.flatMap(u => [
        u.email ? [u.email.toLowerCase(), u._id.toString()] : [],
      ])
    );

    // 2. Fetch all active Calendly events
    const orgUri = await getOrgUri();
    const events = await fetchActiveEvents(orgUri);
    console.log(`[CALENDLY-SYNC] ${events.length} active Calendly event(s) fetched`);

    let updatedCount = 0;

    // 3. For each event, check invitees for matches
    for (const event of events) {
      const startTime = new Date(event.start_time);

      let invitees;
      try {
        invitees = await fetchInvitees(event.uri);
      } catch (err) {
        console.warn(`[CALENDLY-SYNC] Could not fetch invitees for ${event.uri}:`, err.message);
        continue;
      }

      for (const invitee of invitees) {
        const utmContent = invitee.tracking?.utm_content;
        const inviteeEmail = invitee.email?.toLowerCase();
        const inviteeUri = invitee.uri;

        let matchedBookingId = null;

        // PRIMARY: utm_content = bookingId
        if (utmContent && bookingById.has(utmContent)) {
          matchedBookingId = utmContent;
        }
        // FALLBACK: match by email → userId → booking
        else if (inviteeEmail && userIdByEmail.has(inviteeEmail)) {
          const uid = userIdByEmail.get(inviteeEmail);
          if (bookingByUserId.has(uid)) {
            matchedBookingId = bookingByUserId.get(uid)._id.toString();
          }
        }

        if (!matchedBookingId) continue;

        // Update the booking
        try {
          const updated = await SessionBooking.findByIdAndUpdate(
            matchedBookingId,
            {
              status: "scheduled",
              scheduledSlot: startTime,
              ...(inviteeUri && { calendlyEventUri: inviteeUri }),
            },
            { new: true }
          );
          if (updated) {
            console.log(
              `[CALENDLY-SYNC] ✓ Booking ${matchedBookingId} → scheduled at ${startTime.toISOString()}` +
              ` (match: ${utmContent ? "utm_content" : "email"})`
            );
            // Remove from maps so we don't double-update
            bookingById.delete(matchedBookingId);
            bookingByUserId.forEach((b, uid) => {
              if (b._id.toString() === matchedBookingId) bookingByUserId.delete(uid);
            });
            updatedCount++;
          }
        } catch (err) {
          console.error(`[CALENDLY-SYNC] Failed to update booking ${matchedBookingId}:`, err.message);
        }
      }
    }

    if (updatedCount > 0) {
      console.log(`[CALENDLY-SYNC] ✅ Sync complete — ${updatedCount} booking(s) updated`);
    } else {
      console.log("[CALENDLY-SYNC] Sync complete — no matches found");
    }
  } catch (err) {
    console.error("[CALENDLY-SYNC] Sync failed:", err.message);
  }
};

/**
 * Start the Calendly sync cron job — runs every POLL_INTERVAL_MINUTES minutes
 */
export const startCalendlySyncJob = () => {
  if (!PAT) {
    console.warn("[CALENDLY-SYNC] CALENDLY_PAT not set — sync job not started");
    return;
  }

  console.log(`[CALENDLY-SYNC] Starting sync job (every ${POLL_INTERVAL_MINUTES} min)`);

  // Run immediately on startup to catch any previously unsynced bookings
  syncCalendlyBookings();

  cron.schedule(`*/${POLL_INTERVAL_MINUTES} * * * *`, syncCalendlyBookings);
};
