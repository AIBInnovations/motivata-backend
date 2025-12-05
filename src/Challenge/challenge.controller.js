/**
 * @fileoverview Challenge controller with CRUD and user progress operations
 * @module controllers/challenge
 */

import Challenge from "./challenge.schema.js";
import UserChallenge from "./userChallenge.schema.js";
import responseUtil from "../../utils/response.util.js";
import { buildPaginationOptions, buildPaginationMeta } from "../shared/pagination.util.js";

const MAX_ACTIVE_CHALLENGES = 5;

// ============================================
// ADMIN CONTROLLERS
// ============================================

/**
 * Create a new challenge
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createChallenge = async (req, res) => {
  try {
    const challengeData = {
      ...req.body,
      createdBy: req.user.id,
    };

    const challenge = new Challenge(challengeData);
    await challenge.save();

    return responseUtil.created(res, "Challenge created successfully", { challenge });
  } catch (error) {
    console.error("Create challenge error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to create challenge", error.message);
  }
};

/**
 * Get all challenges with pagination (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllChallenges = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      category,
      difficulty,
      isActive,
      search,
    } = req.query;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

    const query = {};

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (typeof isActive !== "undefined") {
      query.isActive = isActive === "true" || isActive === true;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [challenges, totalCount] = await Promise.all([
      Challenge.find(query).sort(sortOptions).skip(skip).limit(limitNum).populate("createdBy", "name email"),
      Challenge.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "Challenges fetched successfully", {
      challenges,
      pagination,
    });
  } catch (error) {
    console.error("Get all challenges error:", error);
    return responseUtil.internalError(res, "Failed to fetch challenges", error.message);
  }
};

/**
 * Get challenge by ID (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getChallengeById = async (req, res) => {
  try {
    const { challengeId } = req.params;

    const challenge = await Challenge.findById(challengeId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    // Get participation stats
    const [totalParticipants, activeParticipants, completedCount] = await Promise.all([
      UserChallenge.countDocuments({ challengeId }),
      UserChallenge.countDocuments({ challengeId, status: "active" }),
      UserChallenge.countDocuments({ challengeId, status: "completed" }),
    ]);

    return responseUtil.success(res, "Challenge fetched successfully", {
      challenge,
      stats: {
        totalParticipants,
        activeParticipants,
        completedCount,
      },
    });
  } catch (error) {
    console.error("Get challenge by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch challenge", error.message);
  }
};

/**
 * Update challenge (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const updates = {
      ...req.body,
      updatedBy: req.user.id,
    };

    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;

    const challenge = await Challenge.findByIdAndUpdate(challengeId, updates, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    return responseUtil.success(res, "Challenge updated successfully", { challenge });
  } catch (error) {
    console.error("Update challenge error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to update challenge", error.message);
  }
};

/**
 * Soft delete challenge (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    await challenge.softDelete(req.user.id);

    return responseUtil.success(res, "Challenge deleted successfully");
  } catch (error) {
    console.error("Delete challenge error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to delete challenge", error.message);
  }
};

/**
 * Toggle challenge active status (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const toggleChallengeStatus = async (req, res) => {
  try {
    const { challengeId } = req.params;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    challenge.isActive = !challenge.isActive;
    challenge.updatedBy = req.user.id;
    await challenge.save();

    return responseUtil.success(res, `Challenge ${challenge.isActive ? "activated" : "deactivated"} successfully`, {
      challenge,
    });
  } catch (error) {
    console.error("Toggle challenge status error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to toggle challenge status", error.message);
  }
};

/**
 * Get challenge categories (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getChallengeCategories = async (req, res) => {
  try {
    const categories = await Challenge.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const categoryLabels = {
      health: "Health",
      fitness: "Fitness",
      mindfulness: "Mindfulness",
      productivity: "Productivity",
      social: "Social",
      creativity: "Creativity",
      learning: "Learning",
      wellness: "Wellness",
      habit: "Habit Building",
      other: "Other",
    };

    const result = categories.map((c) => ({
      key: c._id,
      label: categoryLabels[c._id] || c._id,
      count: c.count,
    }));

    return responseUtil.success(res, "Categories retrieved successfully", { categories: result });
  } catch (error) {
    console.error("Get challenge categories error:", error);
    return responseUtil.internalError(res, "Failed to retrieve categories", error.message);
  }
};

// ============================================
// USER CONTROLLERS
// ============================================

/**
 * Get available challenges for user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAvailableChallenges = async (req, res) => {
  try {
    const { category, difficulty, search, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({
      page,
      limit,
      sortBy: "order",
      sortOrder: "asc",
    });

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [challenges, totalCount] = await Promise.all([
      Challenge.find(query).sort(sortOptions).skip(skip).limit(limitNum).select("-isDeleted -deletedAt -deletedBy"),
      Challenge.countDocuments(query),
    ]);

    // If user is logged in, get their participation status
    let userChallenges = [];
    if (userId) {
      userChallenges = await UserChallenge.find({
        userId,
        challengeId: { $in: challenges.map((c) => c._id) },
      }).select("challengeId status daysCompleted currentStreak");
    }

    const challengesWithStatus = challenges.map((challenge) => {
      const userChallenge = userChallenges.find((uc) => uc.challengeId.toString() === challenge._id.toString());
      return {
        ...challenge.toObject(),
        userStatus: userChallenge
          ? {
              status: userChallenge.status,
              daysCompleted: userChallenge.daysCompleted,
              currentStreak: userChallenge.currentStreak,
            }
          : null,
      };
    });

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "Challenges fetched successfully", {
      challenges: challengesWithStatus,
      pagination,
    });
  } catch (error) {
    console.error("Get available challenges error:", error);
    return responseUtil.internalError(res, "Failed to fetch challenges", error.message);
  }
};

/**
 * Select/join a challenge (max 5)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const joinChallenge = async (req, res) => {
  try {
    const { challengeId } = req.body;
    const userId = req.user.id;

    // Check if challenge exists and is active
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    if (!challenge.isActive) {
      return responseUtil.badRequest(res, "This challenge is not currently available");
    }

    // Check if user already has this challenge
    const existing = await UserChallenge.findByUserAndChallenge(userId, challengeId);
    if (existing) {
      if (existing.status === "active") {
        return responseUtil.conflict(res, "You are already participating in this challenge");
      }
      // Allow rejoining if abandoned/expired/completed
      existing.status = "active";
      existing.startedAt = new Date();
      existing.daysCompleted = 0;
      existing.currentStreak = 0;
      existing.dailyProgress = [];
      existing.lastActivityAt = new Date();
      existing.completedAt = null;

      // Recalculate endsAt
      if (challenge.durationDays) {
        const endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + challenge.durationDays);
        existing.endsAt = endsAt;
      } else {
        existing.endsAt = null;
      }

      await existing.save();

      return responseUtil.success(res, "Challenge rejoined successfully", {
        userChallenge: existing,
      });
    }

    // Check if user has reached max active challenges
    const activeCount = await UserChallenge.countActiveByUser(userId);
    if (activeCount >= MAX_ACTIVE_CHALLENGES) {
      return responseUtil.badRequest(
        res,
        `You can only have ${MAX_ACTIVE_CHALLENGES} active challenges at a time. Please complete or abandon one first.`
      );
    }

    // Create user challenge
    const userChallenge = new UserChallenge({
      userId,
      challengeId,
    });

    await userChallenge.save();

    return responseUtil.created(res, "Challenge joined successfully", {
      userChallenge,
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        taskCount: challenge.tasks.length,
        durationDays: challenge.durationDays,
      },
    });
  } catch (error) {
    console.error("Join challenge error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "You are already participating in this challenge");
    }

    return responseUtil.internalError(res, "Failed to join challenge", error.message);
  }
};

/**
 * Get user's active challenges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMyChallenges = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const challenges = await UserChallenge.find(query)
      .populate("challengeId", "title description category difficulty tasks imageUrl durationDays")
      .sort({ lastActivityAt: -1 });

    // Get today's progress for each active challenge
    const challengesWithProgress = await Promise.all(
      challenges.map(async (uc) => {
        const ucObj = uc.toObject();
        if (uc.status === "active") {
          ucObj.todayProgress = await uc.getTodayProgress();
        }
        return ucObj;
      })
    );

    return responseUtil.success(res, "Your challenges fetched successfully", {
      challenges: challengesWithProgress,
      activeCount: challenges.filter((c) => c.status === "active").length,
      maxAllowed: MAX_ACTIVE_CHALLENGES,
    });
  } catch (error) {
    console.error("Get my challenges error:", error);
    return responseUtil.internalError(res, "Failed to fetch your challenges", error.message);
  }
};

/**
 * Get single user challenge details with today's tasks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getChallengeProgress = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId }).populate(
      "challengeId",
      "title description category difficulty tasks imageUrl durationDays"
    );

    if (!userChallenge) {
      return responseUtil.notFound(res, "You are not participating in this challenge");
    }

    // Get today's progress
    const todayProgress = await userChallenge.getTodayProgress();

    return responseUtil.success(res, "Challenge progress fetched successfully", {
      userChallenge,
      todayProgress,
      challenge: userChallenge.challengeId,
    });
  } catch (error) {
    console.error("Get challenge progress error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch challenge progress", error.message);
  }
};

/**
 * Mark task as complete for today
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const markTaskComplete = async (req, res) => {
  try {
    const { challengeId, taskId } = req.params;
    const userId = req.user.id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId });

    if (!userChallenge) {
      return responseUtil.notFound(res, "You are not participating in this challenge");
    }

    if (userChallenge.status !== "active") {
      return responseUtil.badRequest(res, "This challenge is no longer active");
    }

    // Check if challenge has expired
    if (userChallenge.endsAt && new Date() > userChallenge.endsAt) {
      userChallenge.status = "expired";
      await userChallenge.save();
      return responseUtil.badRequest(res, "This challenge has expired");
    }

    await userChallenge.markTaskComplete(taskId);

    // Get updated today's progress
    const todayProgress = await userChallenge.getTodayProgress();

    return responseUtil.success(res, "Task marked as complete", {
      todayProgress,
      daysCompleted: userChallenge.daysCompleted,
      currentStreak: userChallenge.currentStreak,
      longestStreak: userChallenge.longestStreak,
      allTasksCompletedToday: todayProgress.allTasksCompleted,
    });
  } catch (error) {
    console.error("Mark task complete error:", error);

    if (error.message === "Task not found in challenge") {
      return responseUtil.notFound(res, error.message);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to mark task complete", error.message);
  }
};

/**
 * Unmark task (toggle off)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const unmarkTask = async (req, res) => {
  try {
    const { challengeId, taskId } = req.params;
    const userId = req.user.id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId });

    if (!userChallenge) {
      return responseUtil.notFound(res, "You are not participating in this challenge");
    }

    if (userChallenge.status !== "active") {
      return responseUtil.badRequest(res, "This challenge is no longer active");
    }

    await userChallenge.unmarkTask(taskId);

    const todayProgress = await userChallenge.getTodayProgress();

    return responseUtil.success(res, "Task unmarked", {
      todayProgress,
      daysCompleted: userChallenge.daysCompleted,
    });
  } catch (error) {
    console.error("Unmark task error:", error);

    if (error.message === "Task not found" || error.message === "No progress for today") {
      return responseUtil.badRequest(res, error.message);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to unmark task", error.message);
  }
};

/**
 * Abandon a challenge
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const abandonChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId });

    if (!userChallenge) {
      return responseUtil.notFound(res, "You are not participating in this challenge");
    }

    if (userChallenge.status !== "active") {
      return responseUtil.badRequest(res, "This challenge is not active");
    }

    await userChallenge.abandon();

    return responseUtil.success(res, "Challenge abandoned successfully", {
      challengeId,
      status: "abandoned",
    });
  } catch (error) {
    console.error("Abandon challenge error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to abandon challenge", error.message);
  }
};

/**
 * Get all user challenge progress (admin view)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllUserProgress = async (req, res) => {
  try {
    const { page = 1, limit = 20, challengeId, userId, status, sortBy = "lastActivityAt", sortOrder = "desc" } = req.query;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

    const query = {};
    if (challengeId) query.challengeId = challengeId;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const [progress, totalCount] = await Promise.all([
      UserChallenge.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email phone")
        .populate("challengeId", "title category"),
      UserChallenge.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "User progress fetched successfully", {
      progress,
      pagination,
    });
  } catch (error) {
    console.error("Get all user progress error:", error);
    return responseUtil.internalError(res, "Failed to fetch user progress", error.message);
  }
};

export default {
  // Admin
  createChallenge,
  getAllChallenges,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
  toggleChallengeStatus,
  getChallengeCategories,
  getAllUserProgress,
  // User
  getAvailableChallenges,
  joinChallenge,
  getMyChallenges,
  getChallengeProgress,
  markTaskComplete,
  unmarkTask,
  abandonChallenge,
};
