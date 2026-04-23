/**
 * @fileoverview Challenge reminder cron — pushes FCM notifications twice
 * daily (12:00 PM and 6:00 PM server local time) to every user who has an
 * active challenge and has NOT completed today's tasks for it.
 *
 * Mirrors the day-boundary logic used in UserChallenge.markTaskComplete
 * (start of today via setHours(0,0,0,0) in server local time).
 */

import cron from "node-cron";
import UserChallenge from "../src/Challenge/userChallenge.schema.js";
import User from "../schema/User.schema.js";
import { sendToMultipleDevices } from "../utils/fcm.util.js";

const SCHEDULES = ["0 12 * * *", "0 18 * * *"];

/**
 * Check whether a UserChallenge has today's tasks all done.
 */
const hasCompletedToday = (userChallenge) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const entry = (userChallenge.dailyProgress || []).find((d) => {
    const progressDate = new Date(d.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === todayTime;
  });

  return Boolean(entry && entry.allTasksCompleted);
};

/**
 * Main reminder run — scans active challenges and notifies users with pending tasks.
 */
const runReminderPass = async () => {
  try {
    console.log("[CHALLENGE-REMINDER] Starting reminder pass");

    const now = new Date();

    const activeUCs = await UserChallenge.find({
      status: "active",
      $or: [{ endsAt: { $gt: now } }, { endsAt: null }, { endsAt: { $exists: false } }],
    })
      .populate("challengeId", "title")
      .lean();

    if (activeUCs.length === 0) {
      console.log("[CHALLENGE-REMINDER] No active challenges — nothing to do");
      return;
    }

    const pending = activeUCs.filter((uc) => !hasCompletedToday(uc));

    if (pending.length === 0) {
      console.log("[CHALLENGE-REMINDER] All active users up to date — nothing to send");
      return;
    }

    const userIds = [...new Set(pending.map((uc) => uc.userId.toString()))];
    const users = await User.find(
      { _id: { $in: userIds } },
      "fcmTokens"
    ).lean();
    const tokensByUser = new Map(
      users.map((u) => [
        u._id.toString(),
        (u.fcmTokens || []).map((t) => t.token).filter(Boolean),
      ])
    );

    let sentCount = 0;
    let skippedNoToken = 0;

    for (const uc of pending) {
      const uid = uc.userId.toString();
      const tokens = tokensByUser.get(uid) || [];
      if (tokens.length === 0) {
        skippedNoToken++;
        continue;
      }

      const challengeTitle = uc.challengeId?.title || "your challenge";

      await sendToMultipleDevices({
        tokens,
        title: "Apna challenge complete karo!",
        body: `"${challengeTitle}" ka aaj ka task pending hai. Abhi complete karein.`,
        data: {
          screen: "ChallengeProgress",
          challengeId: String(uc.challengeId?._id || uc.challengeId),
          type: "CHALLENGE_REMINDER",
          userId: uid,
        },
      });
      sentCount++;
    }

    console.log(
      `[CHALLENGE-REMINDER] Pass complete — sent: ${sentCount}, skipped (no token): ${skippedNoToken}, up-to-date: ${activeUCs.length - pending.length}`
    );
  } catch (err) {
    console.error("[CHALLENGE-REMINDER] Reminder pass failed:", err.message);
  }
};

/**
 * Register the two daily reminder cron schedules.
 */
export const startChallengeReminderJobs = () => {
  SCHEDULES.forEach((expr) => {
    cron.schedule(expr, runReminderPass);
  });
  console.log(
    `[CHALLENGE-REMINDER] Reminder jobs scheduled at: ${SCHEDULES.join(", ")}`
  );
};
