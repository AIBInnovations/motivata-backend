/**
 * @fileoverview User Challenge schema for tracking user's selected challenges and daily progress
 * @module schemas/UserChallenge
 */

import mongoose from "mongoose";

/**
 * Daily task completion sub-schema
 */
const dailyTaskProgressSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: false }
);

/**
 * Daily progress sub-schema
 */
const dailyProgressSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    dayNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    tasks: [dailyTaskProgressSchema],
    allTasksCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: true }
);

/**
 * User Challenge schema
 */
const userChallengeSchema = new mongoose.Schema(
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
     * Reference to the challenge
     */
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: [true, "Challenge ID is required"],
    },

    /**
     * Challenge status
     */
    status: {
      type: String,
      enum: {
        values: ["active", "completed", "abandoned", "expired"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
    },

    /**
     * When the user started the challenge
     */
    startedAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * When the challenge ends (calculated from durationDays)
     */
    endsAt: {
      type: Date,
    },

    /**
     * When the user completed the challenge
     */
    completedAt: {
      type: Date,
    },

    /**
     * Last activity timestamp
     */
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * Daily progress tracking
     */
    dailyProgress: [dailyProgressSchema],

    /**
     * Total days completed (all tasks marked done for the day)
     */
    daysCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Current streak
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
     * Last streak update date
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
 * Compound unique index ensures one challenge per user at a time
 */
userChallengeSchema.index({ userId: 1, challengeId: 1 }, { unique: true });
userChallengeSchema.index({ userId: 1, status: 1 });
userChallengeSchema.index({ status: 1 });
userChallengeSchema.index({ lastActivityAt: -1 });

/**
 * Static method to count user's active challenges
 * @param {ObjectId} userId - User ID
 * @returns {Promise<number>} Count of active challenges
 */
userChallengeSchema.statics.countActiveByUser = function (userId) {
  return this.countDocuments({ userId, status: "active" });
};

/**
 * Static method to find user's active challenges
 * @param {ObjectId} userId - User ID
 * @returns {Query} Mongoose query
 */
userChallengeSchema.statics.findActiveByUser = function (userId) {
  return this.find({ userId, status: "active" }).populate("challengeId");
};

/**
 * Static method to check if user has selected a challenge
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} challengeId - Challenge ID
 * @returns {Query} Mongoose query
 */
userChallengeSchema.statics.findByUserAndChallenge = function (userId, challengeId) {
  return this.findOne({ userId, challengeId });
};

/**
 * Instance method to mark task as complete for today
 * @param {ObjectId} taskId - Task ID to mark complete
 * @returns {Promise<UserChallenge>} Updated document
 */
userChallengeSchema.methods.markTaskComplete = async function (taskId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(this.startedAt);
  startDate.setHours(0, 0, 0, 0);
  const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Find or create today's progress
  let todayProgress = this.dailyProgress.find((d) => {
    const progressDate = new Date(d.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === today.getTime();
  });

  if (!todayProgress) {
    // Get challenge to initialize tasks
    const Challenge = mongoose.model("Challenge");
    const challenge = await Challenge.findById(this.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    todayProgress = {
      date: today,
      dayNumber,
      tasks: challenge.tasks.map((t) => ({
        taskId: t._id,
        completed: false,
      })),
      allTasksCompleted: false,
    };
    this.dailyProgress.push(todayProgress);
  }

  // Find today's progress again (in case it was just added)
  const progressIndex = this.dailyProgress.findIndex((d) => {
    const progressDate = new Date(d.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === today.getTime();
  });

  // Mark task complete
  const taskIndex = this.dailyProgress[progressIndex].tasks.findIndex(
    (t) => t.taskId.toString() === taskId.toString()
  );

  if (taskIndex === -1) {
    throw new Error("Task not found in challenge");
  }

  this.dailyProgress[progressIndex].tasks[taskIndex].completed = true;
  this.dailyProgress[progressIndex].tasks[taskIndex].completedAt = new Date();

  // Check if all tasks are completed
  const allCompleted = this.dailyProgress[progressIndex].tasks.every((t) => t.completed);
  if (allCompleted && !this.dailyProgress[progressIndex].allTasksCompleted) {
    this.dailyProgress[progressIndex].allTasksCompleted = true;
    this.dailyProgress[progressIndex].completedAt = new Date();
    this.daysCompleted += 1;

    // Update streak
    this.updateStreak();
  }

  this.lastActivityAt = new Date();

  // Check if challenge is completed (for timed challenges)
  if (this.endsAt) {
    const Challenge = mongoose.model("Challenge");
    const challenge = await Challenge.findById(this.challengeId);
    if (challenge && challenge.durationDays && this.daysCompleted >= challenge.durationDays) {
      this.status = "completed";
      this.completedAt = new Date();
    }
  }

  return this.save();
};

/**
 * Instance method to unmark task (toggle off)
 * @param {ObjectId} taskId - Task ID to unmark
 * @returns {Promise<UserChallenge>} Updated document
 */
userChallengeSchema.methods.unmarkTask = async function (taskId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const progressIndex = this.dailyProgress.findIndex((d) => {
    const progressDate = new Date(d.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === today.getTime();
  });

  if (progressIndex === -1) {
    throw new Error("No progress for today");
  }

  const taskIndex = this.dailyProgress[progressIndex].tasks.findIndex(
    (t) => t.taskId.toString() === taskId.toString()
  );

  if (taskIndex === -1) {
    throw new Error("Task not found");
  }

  // If day was completed, decrement counter
  if (this.dailyProgress[progressIndex].allTasksCompleted) {
    this.daysCompleted = Math.max(0, this.daysCompleted - 1);
  }

  this.dailyProgress[progressIndex].tasks[taskIndex].completed = false;
  this.dailyProgress[progressIndex].tasks[taskIndex].completedAt = null;
  this.dailyProgress[progressIndex].allTasksCompleted = false;
  this.dailyProgress[progressIndex].completedAt = null;

  this.lastActivityAt = new Date();

  return this.save();
};

/**
 * Update streak count
 */
userChallengeSchema.methods.updateStreak = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastStreak = this.lastStreakDate ? new Date(this.lastStreakDate) : null;
  if (lastStreak) {
    lastStreak.setHours(0, 0, 0, 0);
  }

  if (!lastStreak) {
    this.currentStreak = 1;
  } else {
    const diffDays = Math.floor((today - lastStreak) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, no change
    } else if (diffDays === 1) {
      this.currentStreak += 1;
    } else {
      // Streak broken
      this.currentStreak = 1;
    }
  }

  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }

  this.lastStreakDate = today;
};

/**
 * Instance method to get today's progress
 * @returns {Object|null} Today's progress or null
 */
userChallengeSchema.methods.getTodayProgress = async function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let todayProgress = this.dailyProgress.find((d) => {
    const progressDate = new Date(d.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === today.getTime();
  });

  // If no progress for today, initialize it
  if (!todayProgress) {
    const startDate = new Date(this.startedAt);
    startDate.setHours(0, 0, 0, 0);
    const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const Challenge = mongoose.model("Challenge");
    const challenge = await Challenge.findById(this.challengeId);
    if (!challenge) return null;

    todayProgress = {
      date: today,
      dayNumber,
      tasks: challenge.tasks.map((t) => ({
        taskId: t._id,
        completed: false,
      })),
      allTasksCompleted: false,
    };
    this.dailyProgress.push(todayProgress);
    await this.save();
  }

  return todayProgress;
};

/**
 * Instance method to abandon challenge
 * @returns {Promise<UserChallenge>} Updated document
 */
userChallengeSchema.methods.abandon = function () {
  this.status = "abandoned";
  this.lastActivityAt = new Date();
  return this.save();
};

/**
 * Pre-save middleware to set endsAt date
 */
userChallengeSchema.pre("save", async function (next) {
  if (this.isNew && !this.endsAt) {
    const Challenge = mongoose.model("Challenge");
    const challenge = await Challenge.findById(this.challengeId);
    if (challenge && challenge.durationDays) {
      const endsAt = new Date(this.startedAt);
      endsAt.setDate(endsAt.getDate() + challenge.durationDays);
      this.endsAt = endsAt;
    }
  }
  next();
});

const UserChallenge = mongoose.model("UserChallenge", userChallengeSchema);

export default UserChallenge;
