/**
 * @fileoverview Story schema for Connect social feature
 * @module schema/Story
 *
 * Stories are admin-only uploads that appear on the Connect page.
 * Only Motivata admins can create stories; users can only view them.
 */

import mongoose from "mongoose";

/**
 * TTL presets in milliseconds
 */
const TTL_PRESETS = {
  "1_hour": 60 * 60 * 1000,
  "6_hours": 6 * 60 * 60 * 1000,
  "12_hours": 12 * 60 * 60 * 1000,
  "1_day": 24 * 60 * 60 * 1000,
  "3_days": 3 * 24 * 60 * 60 * 1000,
  "7_days": 7 * 24 * 60 * 60 * 1000,
  "30_days": 30 * 24 * 60 * 60 * 1000,
  forever: null,
};

const storySchema = new mongoose.Schema(
  {
    /**
     * Optional title/caption for the story
     */
    title: {
      type: String,
      trim: true,
      maxlength: [500, "Title cannot exceed 500 characters"],
      default: null,
    },

    /**
     * Media URL from Cloudinary
     */
    mediaUrl: {
      type: String,
      required: [true, "Media URL is required"],
      trim: true,
    },

    /**
     * Type of media: image or video
     */
    mediaType: {
      type: String,
      enum: {
        values: ["image", "video"],
        message: "Media type must be either image or video",
      },
      required: [true, "Media type is required"],
    },

    /**
     * Cloudinary public ID for deletion purposes
     */
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Admin who created this story
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "Creator admin ID is required"],
    },

    /**
     * Time to live preset
     */
    ttl: {
      type: String,
      enum: {
        values: [
          "1_hour",
          "6_hours",
          "12_hours",
          "1_day",
          "3_days",
          "7_days",
          "30_days",
          "forever",
        ],
        message: "Invalid TTL preset",
      },
      default: "1_day",
    },

    /**
     * Expiration timestamp - null for forever
     */
    expiresAt: {
      type: Date,
      default: null,
    },

    /**
     * Whether the story is currently active/visible
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * View count for analytics
     */
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Order/priority for display (lower = shown first)
     */
    displayOrder: {
      type: Number,
      default: 0,
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
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Index for fetching active, non-expired stories
 */
storySchema.index({ isActive: 1, isDeleted: 1, expiresAt: 1 });

/**
 * Index for admin's stories
 */
storySchema.index({ createdBy: 1, isDeleted: 1 });

/**
 * Index for display ordering
 */
storySchema.index({ displayOrder: 1, createdAt: -1 });

/**
 * TTL index for automatic expiration (MongoDB will delete expired documents)
 * Note: Documents with null expiresAt won't be deleted
 */
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Pre-save middleware to calculate expiresAt from TTL
 */
storySchema.pre("save", function (next) {
  if (this.isModified("ttl") || this.isNew) {
    const ttlMs = TTL_PRESETS[this.ttl];
    if (ttlMs === null) {
      this.expiresAt = null; // Forever
    } else {
      this.expiresAt = new Date(Date.now() + ttlMs);
    }
  }
  next();
});

/**
 * Pre-query middleware to exclude soft deleted stories
 */
storySchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to get active stories for users
 */
storySchema.statics.getActiveStories = function (options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const now = new Date();

  return this.find({
    isActive: true,
    isDeleted: false,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .select("-isDeleted -deletedAt")
    .sort({ displayOrder: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to get all stories for admin (including inactive)
 */
storySchema.statics.getAllStoriesForAdmin = function (options = {}) {
  const { page = 1, limit = 20, includeExpired = false } = options;
  const skip = (page - 1) * limit;
  const now = new Date();

  const query = { isDeleted: false };

  if (!includeExpired) {
    query.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
  }

  return this.find(query)
    .populate("createdBy", "name username")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to count active stories
 */
storySchema.statics.countActiveStories = function () {
  const now = new Date();
  return this.countDocuments({
    isActive: true,
    isDeleted: false,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });
};

/**
 * Static method to increment view count
 */
storySchema.statics.incrementViewCount = function (storyId) {
  return this.findByIdAndUpdate(
    storyId,
    { $inc: { viewCount: 1 } },
    { new: true }
  );
};

/**
 * Instance method for soft delete
 */
storySchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Static method to check if story is expired
 */
storySchema.statics.isExpired = function (story) {
  if (!story.expiresAt) return false;
  return new Date() > story.expiresAt;
};

/**
 * Export TTL presets for use in controllers
 */
export const TTL_OPTIONS = Object.keys(TTL_PRESETS);

const Story = mongoose.model("Story", storySchema);

export default Story;
