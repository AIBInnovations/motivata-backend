import DailyChallenge from "./dailyChallenge.schema.js";
import DailyChallengeCompletion from "./dailyChallengeCompletion.schema.js";
import Connect from "../../schema/Connect.schema.js";
import responseUtil from "../../utils/response.util.js";
import { dateKeyIST } from "../../utils/timezone.util.js";

const CHALLENGE_FIELDS = "title description leaderName category subCategory difficulty tasks imageUrl icon durationDays";

const resolveEntry = (entry) => {
  if (!entry) return null;
  const plain = typeof entry.toObject === "function" ? entry.toObject() : entry;
  const linked = plain.challengeId && typeof plain.challengeId === "object" ? plain.challengeId : null;

  return {
    _id: plain._id,
    dateKey: plain.dateKey,
    title: plain.title || linked?.title || "",
    description: plain.description || linked?.description || "",
    icon: plain.icon || linked?.icon || null,
    isActive: plain.isActive,
    challenge: linked,
    challengeId: linked ? linked._id : plain.challengeId || null,
  };
};

const weekDateKeys = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const shift = (anchor.getUTCDay() + 6) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - shift);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(anchor);
    day.setUTCDate(anchor.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
};

const countsForDate = async (dateKey, userId) => {
  const totalCompleted = await DailyChallengeCompletion.countDocuments({ dateKey });

  if (!userId) {
    return { totalCompleted, connectionsCompleted: 0 };
  }

  const followingIds = await Connect.find({ follower: userId, isDeleted: false }).distinct("following");

  const connectionsCompleted = followingIds.length
    ? await DailyChallengeCompletion.countDocuments({ dateKey, userId: { $in: followingIds } })
    : 0;

  return { totalCompleted, connectionsCompleted };
};

export const getTodayDailyChallenge = async (req, res) => {
  try {
    const dateKey = dateKeyIST();
    const userId = req.user?.id;

    const entry = await DailyChallenge.findOne({ dateKey, isActive: true, isDeleted: false }).populate(
      "challengeId",
      CHALLENGE_FIELDS
    );

    if (!entry) {
      return responseUtil.success(res, "No daily challenge scheduled for today", {
        dateKey,
        dailyChallenge: null,
        completedByMe: false,
        totalCompleted: 0,
        connectionsCompleted: 0,
      });
    }

    const week = weekDateKeys(dateKey);

    const [counts, mine, weekRows] = await Promise.all([
      countsForDate(dateKey, userId),
      userId ? DailyChallengeCompletion.findOne({ dateKey, userId }).lean() : null,
      userId
        ? DailyChallengeCompletion.find({ userId, dateKey: { $in: week } }).select("dateKey").lean()
        : [],
    ]);

    const completedKeys = new Set(weekRows.map((r) => r.dateKey));

    return responseUtil.success(res, "Today's daily challenge fetched successfully", {
      dateKey,
      dailyChallenge: resolveEntry(entry),
      completedByMe: !!mine,
      week: week.map((key) => ({
        dateKey: key,
        completed: completedKeys.has(key),
        isToday: key === dateKey,
        isPast: key < dateKey,
      })),
      ...counts,
    });
  } catch (error) {
    console.error("Get today daily challenge error:", error);
    return responseUtil.internalError(res, "Failed to fetch daily challenge", error.message);
  }
};

export const completeDailyChallenge = async (req, res) => {
  try {
    const dateKey = dateKeyIST();
    const userId = req.user.id;

    const entry = await DailyChallenge.findOne({ dateKey, isActive: true, isDeleted: false });

    if (!entry) {
      return responseUtil.notFound(res, "No daily challenge scheduled for today");
    }

    await DailyChallengeCompletion.updateOne(
      { dateKey, userId },
      { $setOnInsert: { dailyChallengeId: entry._id, completedAt: new Date() } },
      { upsert: true }
    );

    const counts = await countsForDate(dateKey, userId);

    return responseUtil.success(res, "Daily challenge marked complete", {
      dateKey,
      completedByMe: true,
      ...counts,
    });
  } catch (error) {
    console.error("Complete daily challenge error:", error);

    if (error.code === 11000) {
      const dateKey = dateKeyIST();
      const counts = await countsForDate(dateKey, req.user.id);
      return responseUtil.success(res, "Daily challenge already marked complete", {
        dateKey,
        completedByMe: true,
        ...counts,
      });
    }

    return responseUtil.internalError(res, "Failed to mark daily challenge complete", error.message);
  }
};

export const uncompleteDailyChallenge = async (req, res) => {
  try {
    const dateKey = dateKeyIST();
    const userId = req.user.id;

    await DailyChallengeCompletion.deleteOne({ dateKey, userId });

    const counts = await countsForDate(dateKey, userId);

    return responseUtil.success(res, "Daily challenge marked incomplete", {
      dateKey,
      completedByMe: false,
      ...counts,
    });
  } catch (error) {
    console.error("Uncomplete daily challenge error:", error);
    return responseUtil.internalError(res, "Failed to update daily challenge", error.message);
  }
};

export const createDailyChallenge = async (req, res) => {
  try {
    const entry = new DailyChallenge({ ...req.body, createdBy: req.user.id });
    await entry.save();

    return responseUtil.created(res, "Daily challenge scheduled successfully", { dailyChallenge: entry });
  } catch (error) {
    console.error("Create daily challenge error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "A daily challenge is already scheduled for this date");
    }

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.badRequest(res, error.message);
  }
};

export const bulkScheduleDailyChallenges = async (req, res) => {
  try {
    const { entries, overwrite = false } = req.body;

    const dateKeys = entries.map((e) => e.dateKey);
    const duplicates = dateKeys.filter((k, i) => dateKeys.indexOf(k) !== i);
    if (duplicates.length) {
      return responseUtil.validationError(res, "Validation failed", [
        { field: "entries", message: `Duplicate dates in request: ${[...new Set(duplicates)].join(", ")}` },
      ]);
    }

    const existing = await DailyChallenge.find({ dateKey: { $in: dateKeys } }).select("dateKey");
    const existingKeys = new Set(existing.map((e) => e.dateKey));

    if (existingKeys.size && !overwrite) {
      return responseUtil.conflict(
        res,
        `Already scheduled: ${[...existingKeys].sort().join(", ")}. Send overwrite: true to replace them.`
      );
    }

    const operations = entries.map((entry) => ({
      updateOne: {
        filter: { dateKey: entry.dateKey },
        update: {
          $set: {
            challengeId: entry.challengeId || null,
            title: entry.title || "",
            description: entry.description || "",
            icon: entry.icon || null,
            isActive: entry.isActive !== false,
            isDeleted: false,
            updatedBy: req.user.id,
          },
          $setOnInsert: { dateKey: entry.dateKey, createdBy: req.user.id },
        },
        upsert: true,
      },
    }));

    const result = await DailyChallenge.bulkWrite(operations, { ordered: false });

    return responseUtil.success(res, "Daily challenges scheduled successfully", {
      created: result.upsertedCount || 0,
      updated: result.modifiedCount || 0,
      requested: entries.length,
    });
  } catch (error) {
    console.error("Bulk schedule daily challenges error:", error);
    return responseUtil.internalError(res, "Failed to schedule daily challenges", error.message);
  }
};

export const getDailyChallenges = async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = {};
    if (from || to) {
      query.dateKey = {};
      if (from) query.dateKey.$gte = from;
      if (to) query.dateKey.$lte = to;
    }

    const entries = await DailyChallenge.find(query)
      .sort({ dateKey: 1 })
      .populate("challengeId", "title icon category");

    const completions = await DailyChallengeCompletion.aggregate([
      { $match: { dateKey: { $in: entries.map((e) => e.dateKey) } } },
      { $group: { _id: "$dateKey", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(completions.map((c) => [c._id, c.count]));

    const withCounts = entries.map((e) => ({
      ...e.toObject(),
      completedCount: countMap.get(e.dateKey) || 0,
    }));

    return responseUtil.success(res, "Daily challenges fetched successfully", {
      dailyChallenges: withCounts,
      today: dateKeyIST(),
    });
  } catch (error) {
    console.error("Get daily challenges error:", error);
    return responseUtil.internalError(res, "Failed to fetch daily challenges", error.message);
  }
};

export const updateDailyChallenge = async (req, res) => {
  try {
    const { dailyChallengeId } = req.params;
    const updates = { ...req.body, updatedBy: req.user.id };

    delete updates.dateKey;
    delete updates.createdBy;
    delete updates.isDeleted;

    const existing = await DailyChallenge.findById(dailyChallengeId);
    if (!existing) {
      return responseUtil.notFound(res, "Daily challenge not found");
    }

    const nextChallengeId = "challengeId" in updates ? updates.challengeId : existing.challengeId;
    const nextTitle = "title" in updates ? updates.title : existing.title;
    if (!nextChallengeId && !nextTitle) {
      return responseUtil.validationError(res, "Validation failed", [
        { field: "title", message: "Either challengeId or title is required" },
      ]);
    }

    const entry = await DailyChallenge.findByIdAndUpdate(dailyChallengeId, updates, {
      new: true,
      runValidators: true,
    }).populate("challengeId", "title icon category");

    return responseUtil.success(res, "Daily challenge updated successfully", { dailyChallenge: entry });
  } catch (error) {
    console.error("Update daily challenge error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid daily challenge ID format");
    }

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to update daily challenge", error.message);
  }
};

export const deleteDailyChallenge = async (req, res) => {
  try {
    const { dailyChallengeId } = req.params;

    const entry = await DailyChallenge.findById(dailyChallengeId);
    if (!entry) {
      return responseUtil.notFound(res, "Daily challenge not found");
    }

    await entry.softDelete(req.user.id);

    return responseUtil.success(res, "Daily challenge removed successfully");
  } catch (error) {
    console.error("Delete daily challenge error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid daily challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to remove daily challenge", error.message);
  }
};

export default {
  getTodayDailyChallenge,
  completeDailyChallenge,
  uncompleteDailyChallenge,
  createDailyChallenge,
  bulkScheduleDailyChallenges,
  getDailyChallenges,
  updateDailyChallenge,
  deleteDailyChallenge,
};
