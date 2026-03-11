/**
 * @fileoverview Seed script to simulate challenge history for a user
 *
 * Today = Day 26, started 25 days ago:
 *
 *   Day 1        → uncomplete  (entry exists, allTasksCompleted: false)
 *   Day 2,3,4    → SKIPPED     (no entry)
 *   Day 5        → uncomplete  (entry exists, allTasksCompleted: false)
 *   Day 6        → complete ✅
 *   Day 7,8      → SKIPPED
 *   Day 9,10     → complete ✅ ✅
 *   Day 11–17    → SKIPPED
 *   Day 18       → complete ✅
 *   Day 19,20    → SKIPPED
 *   Day 21       → complete ✅
 *   Day 22,23,24 → SKIPPED
 *   Day 25       → complete ✅  ← yesterday
 *   Day 26       → pending      (today)
 *
 * Expected final state:
 *   daysCompleted  = 6   (days 6,9,10,18,21,25)
 *   currentStreak  = 1   (only day 25 — day 24 skipped se reset)
 *   longestStreak  = 2   (days 9 & 10)
 *
 * Dot colors:
 *   Day 1,5        → 🟡 light green  (uncomplete — entry exists)
 *   Day 6,9,10,18,21,25 → 🟢 dark green (complete)
 *   All other past days  → ⬜ grey       (skipped, no entry)
 *   Day 26         → 🟡 light green  (today, pending)
 *
 * Usage:
 *   1. Set USER_PHONE below to the target user's phone number
 *   2. Run: node scripts/testing/seedChallengeHistory.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

// ─── CONFIG ────────────────────────────────────────────────────────────────
const USER_PHONE = "9522455243"; // target user's phone number

// MongoDB URL: reads from env, or pass as first CLI arg:
//   node scripts/testing/seedChallengeHistory.js "mongodb+srv://..."
const MONGODB_URL =
  process.argv[2] ||
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI;
// ───────────────────────────────────────────────────────────────────────────

import User from "../../schema/User.schema.js";
import Challenge from "../../src/Challenge/challenge.schema.js";
import UserChallenge from "../../src/Challenge/userChallenge.schema.js";

/**
 * Returns a Date object set to midnight (00:00:00.000) for `daysAgo` days before today.
 */
function daysAgoMidnight(daysAgo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/**
 * Builds the dailyProgress array.
 * startedAt = 10 days ago → today = Day 11
 *
 * Three types of entries:
 *   "complete"   → allTasksCompleted: true,  all tasks completed
 *   "uncomplete" → allTasksCompleted: false, tasks NOT completed (entry exists but incomplete)
 *   (absent)     → SKIPPED, grey dot
 */
function buildDailyProgress(tasks, startedAt) {
  // day config: type = "complete" | "uncomplete"
  // All other days are SKIPPED (not in this array at all)
  const dayConfigs = [
    { dayNumber: 1,  daysAfterStart: 0,  type: "uncomplete" },
    // Day 2,3,4 SKIPPED
    { dayNumber: 5,  daysAfterStart: 4,  type: "uncomplete" },
    { dayNumber: 6,  daysAfterStart: 5,  type: "complete"   },
    // Day 7,8 SKIPPED
    { dayNumber: 9,  daysAfterStart: 8,  type: "complete"   },
    { dayNumber: 10, daysAfterStart: 9,  type: "complete"   },
    // Day 11–17 SKIPPED
    { dayNumber: 18, daysAfterStart: 17, type: "complete"   },
    // Day 19,20 SKIPPED
    { dayNumber: 21, daysAfterStart: 20, type: "complete"   },
    // Day 22,23,24 SKIPPED
    { dayNumber: 25, daysAfterStart: 24, type: "complete"   }, // yesterday
    // Day 26 = today → no entry here (todayProgress handles it)
  ];

  return dayConfigs.map(({ dayNumber, daysAfterStart, type }) => {
    const date = new Date(startedAt);
    date.setDate(date.getDate() + daysAfterStart);
    date.setHours(0, 0, 0, 0);

    const isComplete = type === "complete";
    const completedAt = isComplete ? new Date(new Date(date).setHours(20, 0, 0, 0)) : null;

    return {
      date,
      dayNumber,
      tasks: tasks.map((t) => ({
        taskId: t._id,
        completed: isComplete,
        completedAt: isComplete ? completedAt : null,
      })),
      allTasksCompleted: isComplete,
      completedAt: isComplete ? completedAt : null,
    };
  });
}

async function seed() {
  try {
    console.log("🌱 Challenge History Seed Script");
    console.log("=".repeat(60));

    if (!MONGODB_URL) {
      console.error("❌ MongoDB URL not found.");
      console.error("   Pass it as a CLI argument:");
      console.error('   node scripts/testing/seedChallengeHistory.js "mongodb+srv://..."');
      console.error("   Or set MONGODB_URL / MONGODB_URI in your environment.");
      process.exit(1);
    }
    await mongoose.connect(MONGODB_URL);
    console.log("✅ Connected to MongoDB\n");

    // ── 1. Find user by phone ──────────────────────────────────────────────
    const user = await User.findOne({ phone: USER_PHONE });
    if (!user) {
      console.error(`❌ No user found with phone: ${USER_PHONE}`);
      console.error("   Update USER_PHONE at the top of this script.");
      process.exit(1);
    }
    console.log(`👤 User found: ${user.name || user.phone} (${user._id})`);

    // ── 2. Find an active challenge ────────────────────────────────────────
    // Prefer one the user is already in; otherwise pick any active challenge
    let challenge = null;

    const existingUC = await UserChallenge.findOne({
      userId: user._id,
      status: "active",
    }).populate("challengeId");

    if (existingUC && existingUC.challengeId) {
      challenge = existingUC.challengeId;
      console.log(`🎯 Using existing active challenge: "${challenge.title}"`);
    } else {
      challenge = await Challenge.findOne({ isActive: true, isDeleted: false });
      if (!challenge) {
        console.error("❌ No active challenge found in DB.");
        process.exit(1);
      }
      console.log(`🎯 Using challenge: "${challenge.title}"`);
    }

    if (!challenge.tasks || challenge.tasks.length === 0) {
      console.error("❌ Challenge has no tasks.");
      process.exit(1);
    }
    console.log(`   Tasks: ${challenge.tasks.map((t) => t.title).join(", ")}\n`);

    // ── 3. Build simulated history ─────────────────────────────────────────
    // Started 25 days ago so today = Day 26
    const startedAt = daysAgoMidnight(25);
    const dailyProgress = buildDailyProgress(challenge.tasks, startedAt);

    // Streak breakdown (mirrors updateStreak() logic):
    //   Day 1  uncomplete → no streak (allTasksCompleted: false)
    //   Days 2–4  SKIPPED
    //   Day 5  uncomplete → no streak
    //   Day 6  complete   → streak = 1
    //   Days 7–8  SKIPPED → streak broken
    //   Day 9  complete   → streak = 1 (reset)
    //   Day 10 complete   → streak = 2  ← longestStreak
    //   Days 11–17 SKIPPED → streak broken
    //   Day 18 complete   → streak = 1 (reset)
    //   Days 19–20 SKIPPED → streak broken
    //   Day 21 complete   → streak = 1 (reset)
    //   Days 22–24 SKIPPED → streak broken
    //   Day 25 complete   → streak = 1 (reset) ← currentStreak
    const currentStreak = 1;
    const longestStreak = 2; // days 9 & 10
    const daysCompleted = 6; // days 6,9,10,18,21,25
    const lastStreakDate = daysAgoMidnight(1); // yesterday = Day 25

    // endsAt based on durationDays
    let endsAt = null;
    if (challenge.durationDays) {
      endsAt = new Date(startedAt);
      endsAt.setDate(endsAt.getDate() + challenge.durationDays);
    }

    // ── 4. Upsert the UserChallenge ────────────────────────────────────────
    const filter = { userId: user._id, challengeId: challenge._id };

    const update = {
      $set: {
        status: "active",
        startedAt,
        endsAt,
        lastActivityAt: daysAgoMidnight(1),
        dailyProgress,
        daysCompleted,
        currentStreak,
        longestStreak,
        lastStreakDate,
        completedAt: null,
      },
    };

    const uc = await UserChallenge.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    // ── 5. Report ──────────────────────────────────────────────────────────
    console.log("✅ UserChallenge seeded successfully!\n");
    console.log("📊 Summary:");
    console.log(`   Challenge      : ${challenge.title}`);
    console.log(`   Started At     : ${startedAt.toDateString()} (Day 1)`);
    console.log(`   Today is       : Day 26`);
    console.log(`   Days Completed : ${uc.daysCompleted}  (days 6,9,10,18,21,25)`);
    console.log(`   Current Streak : ${uc.currentStreak}  (only day 25 — day 24 skip se reset)`);
    console.log(`   Longest Streak : ${uc.longestStreak}  (days 9 & 10)`);
    console.log(`   Last Streak Dt : ${uc.lastStreakDate?.toDateString()}`);
    console.log("\n📅 Dot Colors:");

    const complete  = new Set([6, 9, 10, 18, 21, 25]);
    const incomplete = new Set([1, 5]);
    for (let d = 1; d <= 26; d++) {
      let label;
      if (d === 26)              label = "🟡 light green  (today — pending)";
      else if (complete.has(d))  label = "🟢 dark green   (complete ✅)";
      else if (incomplete.has(d))label = "🟡 light green  (uncomplete — entry exists, not done)";
      else                       label = "⬜ grey          (SKIPPED — no entry)";
      console.log(`   Day ${String(d).padStart(2)}: ${label}`);
    }

    console.log("\n🧪 What to test:");
    console.log("   • daysCompleted = 6  (days 6,9,10,18,21,25 only)");
    console.log("   • currentStreak = 1  (day 24 skip ke baad reset — sirf day 25)");
    console.log("   • longestStreak = 2  (days 9 & 10 consecutive)");
    console.log("   • Days 1,5  → light green (uncomplete — entry hai, grey nahi!)");
    console.log("   • Aaj complete karo → currentStreak 2 ho jaani chahiye");

    await mongoose.disconnect();
    console.log("\n📡 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

seed();
