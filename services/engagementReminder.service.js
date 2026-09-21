import cron from "node-cron";
import Event from "../schema/Event.schema.js";
import EventEnrollment from "../schema/EventEnrollment.schema.js";
import User from "../schema/User.schema.js";
import DailySOSAnswer from "../src/Quiz/schemas/dailySosAnswer.schema.js";
import { dateKeyIST } from "../utils/timezone.util.js";
import { notifyUsers } from "./userNotification.service.js";

const TIMEZONE = "Asia/Kolkata";
const HOUR_MS = 60 * 60 * 1000;

const EVENT_WINDOWS = [
  {
    field: "reminderDayBeforeSentAt",
    fromMs: 20 * HOUR_MS,
    toMs: 24 * HOUR_MS,
    title: (event) => `Tomorrow: ${event.name}`,
    body: (event) =>
      `Your event starts tomorrow${event.venueName ? ` at ${event.venueName}` : ""}. See you there!`,
  },
  {
    field: "reminderSoonSentAt",
    fromMs: 0,
    toMs: 2 * HOUR_MS,
    title: (event) => `Starting soon: ${event.name}`,
    body: (event) =>
      event.mode === "ONLINE" ? "Your event starts in under 2 hours. Keep your joining link ready." : "Your event starts in under 2 hours.",
  },
];

export const runEventReminderPass = async () => {
  try {
    const now = Date.now();
    for (const window of EVENT_WINDOWS) {
      const events = await Event.find({
        isLive: true,
        startDate: { $gt: new Date(now + window.fromMs), $lte: new Date(now + window.toMs) },
        [window.field]: null,
      })
        .select("_id name venueName mode startDate")
        .lean();

      for (const event of events) {
        const claimed = await Event.findOneAndUpdate(
          { _id: event._id, [window.field]: null },
          { $set: { [window.field]: new Date() } },
          { new: true }
        );
        if (!claimed) continue;

        const userIds = await EventEnrollment.find({ eventId: event._id }).distinct("userId");
        if (userIds.length === 0) continue;

        await notifyUsers({
          userIds,
          category: "EVENTS",
          type: "EVENT_REMINDER",
          title: window.title(event),
          body: window.body(event),
          data: { screen: "EventDetail", eventId: String(event._id) },
        });
        console.log(`[EVENT-REMINDER] ${window.field} sent for ${event.name} to ${userIds.length} users`);
      }
    }
  } catch (error) {
    console.error("[EVENT-REMINDER] Pass failed:", error.message);
  }
};

export const runDailySosReminderPass = async () => {
  try {
    const today = dateKeyIST();
    const [answered, candidates] = await Promise.all([
      DailySOSAnswer.find({ dateKey: today }).distinct("userId"),
      User.find(
        {
          isDeleted: false,
          "fcmTokens.0": { $exists: true },
          "notificationPrefs.sosReminders": { $ne: false },
        },
        "_id"
      ).lean(),
    ]);
    const answeredSet = new Set(answered.map(String));
    const userIds = candidates.map((u) => String(u._id)).filter((id) => !answeredSet.has(id));
    if (userIds.length === 0) return;

    await notifyUsers({
      userIds,
      category: "SOS",
      type: "DAILY_SOS_REMINDER",
      title: "Your daily SOS check-in",
      body: "Take a minute to answer today's question and stay sorted.",
      data: { screen: "SOS" },
      store: false,
    });
    console.log(`[SOS-REMINDER] Sent to ${userIds.length} users`);
  } catch (error) {
    console.error("[SOS-REMINDER] Pass failed:", error.message);
  }
};

export const startEngagementReminderJobs = () => {
  cron.schedule("*/15 * * * *", runEventReminderPass, { timezone: TIMEZONE });
  cron.schedule("30 9 * * *", runDailySosReminderPass, { timezone: TIMEZONE });
  console.log("[REMINDERS] Event reminders every 15 min, daily SOS reminder at 09:30 IST");
};

export default { startEngagementReminderJobs, runEventReminderPass, runDailySosReminderPass };
