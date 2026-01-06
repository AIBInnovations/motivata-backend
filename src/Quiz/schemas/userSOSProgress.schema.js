/**
 * @fileoverview User SOS Progress schema for tracking user progress through SOS programs
 * @module schemas/UserSOSProgress
 */

import mongoose from "mongoose";

/**
 * Quiz response sub-schema for individual question answers
 */
const quizResponseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: false, // Allow skipping questions
      default: null,
    },
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Daily progress sub-schema for tracking each day's completion
 */
const dailyProgressSchema = new mongoose.Schema(
  {
    dayNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SOSQuiz",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped"],
      default: "pending",
    },
    responses: [quizResponseSchema],
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: true }
);

/**
 * User SOS Progress schema
 */
const userSOSProgressSchema = new mongoose.Schema(
  {
    /**
     * Reference to the user
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    /**
     * Reference to the SOS program
     */
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SOSProgram",
      required: [true, "Program ID is required"],
    },

    /**
     * Current day in the program (1-based)
     */
    currentDay: {
      type: Number,
      default: 1,
      min: 1,
    },

    /**
     * Overall progress status
     */
    status: {
      type: String,
      enum: {
        values: ["not_started", "in_progress", "completed", "abandoned"],
        message: "{VALUE} is not a valid status",
      },
      default: "not_started",
    },

    /**
     * When the user started the program
     */
    startedAt: {
      type: Date,
    },

    /**
     * When the user completed the program
     */
    completedAt: {
      type: Date,
    },

    /**
     * Last activity timestamp
     */
    lastActivityAt: {
      type: Date,
    },

    /**
     * Daily progress tracking
     */
    dailyProgress: [dailyProgressSchema],

    /**
     * Total score accumulated across all days
     */
    totalScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Maximum possible score for completed days
     */
    maxPossibleScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Number of days completed
     */
    daysCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Streak count (consecutive days completed)
     */
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Longest streak achieved
     */
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Last streak update date (for streak calculation)
     */
    lastStreakDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 * Compound unique index ensures one progress record per user per program
 */
userSOSProgressSchema.index({ userId: 1, programId: 1 }, { unique: true });
userSOSProgressSchema.index({ userId: 1, status: 1 });
userSOSProgressSchema.index({ programId: 1, status: 1 });
userSOSProgressSchema.index({ status: 1, lastActivityAt: -1 });

/**
 * Virtual for completion percentage
 */
userSOSProgressSchema.virtual("completionPercentage").get(function () {
  if (!this.dailyProgress || this.dailyProgress.length === 0) return 0;
  const completed = this.dailyProgress.filter((d) => d.status === "completed").length;
  return Math.round((completed / this.dailyProgress.length) * 100);
});

/**
 * Virtual for score percentage
 */
userSOSProgressSchema.virtual("scorePercentage").get(function () {
  if (!this.maxPossibleScore || this.maxPossibleScore === 0) return 0;
  return Math.round((this.totalScore / this.maxPossibleScore) * 100);
});

/**
 * Calculate the expected current day based on startedAt date
 * @returns {number} Expected day number
 */
userSOSProgressSchema.methods.calculateExpectedDay = function () {
  if (!this.startedAt) return 1;
  const now = new Date();
  const start = new Date(this.startedAt);
  const diffTime = now - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
};

/**
 * Start the program
 * @returns {Promise<UserSOSProgress>} Updated document
 */
userSOSProgressSchema.methods.startProgram = function () {
  this.status = "in_progress";
  this.startedAt = new Date();
  this.lastActivityAt = new Date();
  this.currentDay = 1;
  return this.save();
};

/**
 * Record quiz completion for a day
 * @param {number} dayNumber - Day number
 * @param {ObjectId} quizId - Quiz ID
 * @param {Array} responses - Array of quiz responses
 * @param {number} score - Score earned
 * @param {number} maxScore - Maximum possible score
 * @returns {Promise<UserSOSProgress>} Updated document
 */
userSOSProgressSchema.methods.recordDayCompletion = async function (
  dayNumber,
  quizId,
  responses,
  score,
  maxScore
) {
  // Find or create daily progress entry
  let dayProgress = this.dailyProgress.find((d) => d.dayNumber === dayNumber);

  if (!dayProgress) {
    dayProgress = {
      dayNumber,
      quizId,
      status: "pending",
      responses: [],
      score: 0,
      maxScore: 0,
    };
    this.dailyProgress.push(dayProgress);
    dayProgress = this.dailyProgress[this.dailyProgress.length - 1];
  }

  dayProgress.quizId = quizId;
  dayProgress.responses = responses;
  dayProgress.score = score;
  dayProgress.maxScore = maxScore;
  dayProgress.status = "completed";
  dayProgress.completedAt = new Date();

  // Update totals
  this.totalScore = this.dailyProgress.reduce((sum, d) => sum + (d.score || 0), 0);
  this.maxPossibleScore = this.dailyProgress.reduce((sum, d) => sum + (d.maxScore || 0), 0);
  this.daysCompleted = this.dailyProgress.filter((d) => d.status === "completed").length;

  // Update streak
  this.updateStreak();

  // Update current day if needed
  if (dayNumber >= this.currentDay) {
    this.currentDay = dayNumber + 1;
  }

  this.lastActivityAt = new Date();

  return this.save();
};

/**
 * Update streak count
 */
userSOSProgressSchema.methods.updateStreak = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastStreak = this.lastStreakDate ? new Date(this.lastStreakDate) : null;
  if (lastStreak) {
    lastStreak.setHours(0, 0, 0, 0);
  }

  if (!lastStreak) {
    // First completion
    this.currentStreak = 1;
  } else {
    const diffDays = Math.floor((today - lastStreak) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, no change
    } else if (diffDays === 1) {
      // Consecutive day
      this.currentStreak += 1;
    } else {
      // Streak broken
      this.currentStreak = 1;
    }
  }

  // Update longest streak
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }

  this.lastStreakDate = today;
};

/**
 * Mark program as completed
 * @returns {Promise<UserSOSProgress>} Updated document
 */
userSOSProgressSchema.methods.completeProgram = function () {
  this.status = "completed";
  this.completedAt = new Date();
  this.lastActivityAt = new Date();
  return this.save();
};

/**
 * Mark program as abandoned
 * @returns {Promise<UserSOSProgress>} Updated document
 */
userSOSProgressSchema.methods.abandonProgram = function () {
  this.status = "abandoned";
  this.lastActivityAt = new Date();
  return this.save();
};

/**
 * Static method to find user's active programs
 * @param {ObjectId} userId - User ID
 * @returns {Query} Mongoose query
 */
userSOSProgressSchema.statics.findActiveByUser = function (userId) {
  return this.find({
    userId,
    status: { $in: ["not_started", "in_progress"] },
  }).populate("programId");
};

/**
 * Static method to find completed programs by user
 * @param {ObjectId} userId - User ID
 * @returns {Query} Mongoose query
 */
userSOSProgressSchema.statics.findCompletedByUser = function (userId) {
  return this.find({
    userId,
    status: "completed",
  }).populate("programId");
};

/**
 * Static method to get user's progress for a specific program
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} programId - Program ID
 * @returns {Query} Mongoose query
 */
userSOSProgressSchema.statics.findByUserAndProgram = function (userId, programId) {
  return this.findOne({ userId, programId }).populate("programId");
};

/**
 * Static method to get leaderboard for a program
 * @param {ObjectId} programId - Program ID
 * @param {number} limit - Number of entries
 * @returns {Query} Mongoose query
 */
userSOSProgressSchema.statics.getLeaderboard = function (programId, limit = 10) {
  return this.find({
    programId,
    status: { $in: ["in_progress", "completed"] },
  })
    .sort({ totalScore: -1 })
    .limit(limit)
    .populate("userId", "name avatar");
};

const UserSOSProgress = mongoose.model("UserSOSProgress", userSOSProgressSchema);

export default UserSOSProgress;
