import mongoose from "mongoose";
import UserChallenge from "../src/Challenge/userChallenge.schema.js";
import DailyChallengeCompletion from "../src/Challenge/dailyChallengeCompletion.schema.js";
import UserSOSProgress from "../src/Quiz/schemas/userSOSProgress.schema.js";
import DailyReflection from "../src/Quiz/schemas/dailyReflection.schema.js";
import DailySOSAnswer from "../src/Quiz/schemas/dailySosAnswer.schema.js";
import QoLEntry from "../src/Quiz/schemas/qolEntry.schema.js";
import EventEnrollment from "../schema/EventEnrollment.schema.js";
import JobApplication from "../schema/JobApplication.schema.js";
import JobPost from "../schema/JobPost.schema.js";
import ClubMember from "../schema/ClubMember.schema.js";
import Connect from "../schema/Connect.schema.js";
import Recommendation from "../schema/Recommendation.schema.js";
import WeeklyUpdate from "../schema/WeeklyUpdate.schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GROWTH_SCORE_MAX = 1000;

export const GROWTH_SCORE_RULES = [
  { key: "challenges", label: "30-Day Challenges", max: 300, rule: "10 points for every challenge day completed in the last 30 days" },
  { key: "dailyChallenges", label: "Daily Challenges", max: 100, rule: "5 points for every daily challenge done in the last 30 days" },
  { key: "sos", label: "SOS", max: 300, rule: "100 for Simple SOS, 150 for Intensive SOS (15 per day while in progress), 2 per daily reflection / check-in in the last 30 days (up to 50)" },
  { key: "events", label: "Events", max: 150, rule: "25 points for every event booked in the last 12 months" },
  { key: "community", label: "Community", max: 150, rule: "5 per connection (up to 50), 10 per recommendation in the last 90 days (up to 50), 10 per weekly update in the last 90 days (up to 50)" },
];

const GROWTH_LEVELS = [
  { min: 800, name: "Trailblazer" },
  { min: 600, name: "Achiever" },
  { min: 400, name: "Doer" },
  { min: 200, name: "Explorer" },
  { min: 0, name: "Starter" },
];

const cap = (value, max) => Math.max(0, Math.min(max, Math.round(value)));

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const countConnections = async (userId) => {
  const [asFollower, asFollowing] = await Promise.all([
    Connect.find({ follower: userId, isDeleted: false }).distinct("following"),
    Connect.find({ following: userId, isDeleted: false }).distinct("follower"),
  ]);
  return new Set([...asFollower, ...asFollowing].map(String)).size;
};

export const computeGrowthScore = async (userId) => {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const since90 = new Date(now - 90 * DAY_MS);
  const since365 = new Date(now - 365 * DAY_MS);
  const uid = toObjectId(userId);

  const [
    userChallenges,
    dailyDone,
    sosProgress,
    reflections,
    dailyAnswers,
    qolEntries,
    eventsBooked,
    connections,
    recommendations,
    weeklyUpdates,
  ] = await Promise.all([
    UserChallenge.find({ userId: uid }).select("dailyProgress").lean(),
    DailyChallengeCompletion.countDocuments({ userId: uid, completedAt: { $gte: since30 } }),
    UserSOSProgress.find({ userId: uid }).populate("programId", "type").select("status daysCompleted programId").lean(),
    DailyReflection.countDocuments({ userId: uid, answeredAt: { $gte: since30 } }),
    DailySOSAnswer.countDocuments({ userId: uid, answeredAt: { $gte: since30 } }),
    QoLEntry.countDocuments({ userId: uid, createdAt: { $gte: since30 } }),
    EventEnrollment.countDocuments({ userId: uid, createdAt: { $gte: since365 } }),
    countConnections(uid),
    Recommendation.countDocuments({ author: uid, isDeleted: false, createdAt: { $gte: since90 } }),
    WeeklyUpdate.countDocuments({ user: uid, isDeleted: false, createdAt: { $gte: since90 } }),
  ]);

  const challengeDays = userChallenges.reduce(
    (sum, uc) =>
      sum +
      (uc.dailyProgress || []).filter((d) => d.allTasksCompleted && new Date(d.date) >= since30).length,
    0
  );

  let sosPoints = 0;
  const simpleDone = sosProgress.some((p) => p.programId?.type === "GSOS" && p.status === "completed");
  const intensive = sosProgress.filter((p) => p.programId?.type === "ISOS");
  const intensiveDone = intensive.some((p) => p.status === "completed");
  if (simpleDone) sosPoints += 100;
  if (intensiveDone) sosPoints += 150;
  else sosPoints += Math.min(105, Math.max(0, ...intensive.map((p) => (p.daysCompleted || 0) * 15), 0));
  sosPoints += Math.min(50, (reflections + dailyAnswers + qolEntries) * 2);

  const breakdown = {
    challenges: cap(challengeDays * 10, 300),
    dailyChallenges: cap(dailyDone * 5, 100),
    sos: cap(sosPoints, 300),
    events: cap(eventsBooked * 25, 150),
    community: cap(
      Math.min(50, connections * 5) + Math.min(50, recommendations * 10) + Math.min(50, weeklyUpdates * 10),
      150
    ),
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const level = GROWTH_LEVELS.find((l) => score >= l.min).name;

  return {
    score,
    max: GROWTH_SCORE_MAX,
    level,
    breakdown: GROWTH_SCORE_RULES.map((r) => ({ ...r, points: breakdown[r.key] })),
  };
};

export const getProfileSections = async (userId) => {
  const uid = toObjectId(userId);
  const now = new Date();

  const [challenges, applications, postedJobs, enrollments, clubs, sosProgress] = await Promise.all([
    UserChallenge.find({ userId: uid, status: "active" })
      .populate("challengeId", "title imageUrl")
      .select("challengeId daysCompleted selectedDurationDays currentStreak startedAt")
      .sort({ startedAt: -1 })
      .limit(10)
      .lean(),
    JobApplication.find({ user: uid })
      .populate("job", "title company isActive")
      .select("job status createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    JobPost.find({ postedByUser: uid, approvalStatus: "APPROVED", isActive: true })
      .select("title company createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    EventEnrollment.find({ userId: uid })
      .populate("eventId", "name startDate city mode")
      .select("eventId createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    ClubMember.find({ user: uid, status: "APPROVED" })
      .populate({ path: "club", select: "name thumbnail", match: { isDeleted: false } })
      .select("club role")
      .lean(),
    UserSOSProgress.find({ userId: uid, status: "completed" })
      .populate("programId", "type title")
      .select("programId completedAt")
      .sort({ completedAt: -1 })
      .lean(),
  ]);

  return {
    challenges: challenges
      .filter((c) => c.challengeId)
      .map((c) => ({
        id: c._id,
        title: c.challengeId.title,
        imageUrl: c.challengeId.imageUrl || null,
        daysCompleted: c.daysCompleted || 0,
        durationDays: c.selectedDurationDays || null,
        currentStreak: c.currentStreak || 0,
      })),
    opportunities: [
      ...applications
        .filter((a) => a.job && a.job.isActive)
        .map((a) => ({ id: a.job._id, title: a.job.title, company: a.job.company, relation: "APPLIED", status: a.status })),
      ...postedJobs.map((j) => ({ id: j._id, title: j.title, company: j.company, relation: "POSTED", status: "LIVE" })),
    ],
    events: enrollments
      .filter((e) => e.eventId && new Date(e.eventId.startDate) >= now)
      .sort((a, b) => new Date(a.eventId.startDate) - new Date(b.eventId.startDate))
      .map((e) => ({
        id: e.eventId._id,
        name: e.eventId.name,
        startDate: e.eventId.startDate,
        city: e.eventId.city || null,
        mode: e.eventId.mode || null,
      })),
    clubs: clubs
      .filter((m) => m.club)
      .map((m) => ({ id: m.club._id, name: m.club.name, thumbnail: m.club.thumbnail || null, isClubAdmin: m.role === "ADMIN" })),
    sosReports: sosProgress
      .filter((p) => p.programId)
      .map((p) => ({
        id: p._id,
        type: p.programId.type === "ISOS" ? "INTENSIVE" : "SIMPLE",
        label: p.programId.type === "ISOS" ? "Intensive SOS (Day 7 report)" : "Simple SOS (Day 1 report)",
        completedAt: p.completedAt,
      })),
  };
};

export default { computeGrowthScore, getProfileSections, GROWTH_SCORE_RULES, GROWTH_SCORE_MAX };
