/**
 * @fileoverview Challenge schema for daily challenges with tasks
 * @module schemas/Challenge
 */

import mongoose from "mongoose";

/**
 * Task sub-schema for challenge tasks
 */
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Task title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Task description cannot exceed 500 characters"],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Challenge schema
 */
const challengeSchema = new mongoose.Schema(
  {
    /**
     * Challenge title
     */
    title: {
      type: String,
      required: [true, "Challenge title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    /**
     * Challenge description
     */
    description: {
      type: String,
      required: [true, "Challenge description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    /**
     * Challenge category
     */
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "health",
          "fitness",
          "mindfulness",
          "productivity",
          "social",
          "creativity",
          "learning",
          "wellness",
          "habit",
          "other",
        ],
        message: "{VALUE} is not a valid category",
      },
    },

    /**
     * Challenge difficulty
     */
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    /**
     * Challenge tasks (at least one required)
     */
    tasks: {
      type: [taskSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Challenge must have at least one task",
      },
    },

    /**
     * Duration in days (null = no limit)
     */
    durationDays: {
      type: Number,
      min: [1, "Duration must be at least 1 day"],
      max: [365, "Duration cannot exceed 365 days"],
      default: null,
    },

    /**
     * Cover image URL
     */
    imageUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },

    /**
     * Whether the challenge is active
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Display order
     */
    order: {
      type: Number,
      default: 0,
    },

    /**
     * Created by (admin)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /**
     * Last updated by (admin)
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      select: false,
    },

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 */
challengeSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
challengeSchema.index({ isActive: 1, isDeleted: 1 });
challengeSchema.index({ difficulty: 1 });
challengeSchema.index({ createdAt: -1 });

/**
 * Virtual for task count
 */
challengeSchema.virtual("taskCount").get(function () {
  return this.tasks ? this.tasks.length : 0;
});

/**
 * Pre-query middleware to exclude soft deleted documents
 */
challengeSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Instance method for soft delete
 * @param {ObjectId} adminId - ID of admin performing deletion
 * @returns {Promise<Challenge>} Updated document
 */
challengeSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted challenge
 * @returns {Promise<Challenge>} Restored document
 */
challengeSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method to find active challenges
 * @param {Object} filter - Additional filters
 * @returns {Query} Mongoose query
 */
challengeSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isActive: true, isDeleted: false });
};

/**
 * Static method to find by category
 * @param {string} category - Category name
 * @returns {Query} Mongoose query
 */
challengeSchema.statics.findByCategory = function (category) {
  return this.find({ category, isActive: true, isDeleted: false }).sort({ order: 1 });
};

const Challenge = mongoose.model("Challenge", challengeSchema);

export default Challenge;
