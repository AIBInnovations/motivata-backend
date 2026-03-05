/**
 * @fileoverview ChallengeStory schema for user-generated challenge stories
 * @module schema/ChallengeStory
 *
 * Challenge stories are user-generated posts tied to specific challenges.
 * Any user with an active UserChallenge can create stories that auto-expire after 24 hours.
 * Supports image, video, and text-only stories.
 */

import mongoose from "mongoose";

const challengeStorySchema = new mongoose.Schema(
  {
    /**
     * User who created this story
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    /**
     * Challenge this story belongs to
     */
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: [true, "Challenge ID is required"],
    },

    /**
     * Type of media: image, video, or text-only
     */
    mediaType: {
      type: String,
      enum: {
        values: ["image", "video", "text"],
        message: "Media type must be image, video, or text",
      },
      required: [true, "Media type is required"],
    },

    /**
     * Media URL from Cloudinary (required for image/video, null for text)
     */
    mediaUrl: {
      type: String,
      trim: true,
      default: null,
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
     * Caption text (required for text stories, optional for image/video)
     */
    caption: {
      type: String,
      trim: true,
      maxlength: [500, "Caption cannot exceed 500 characters"],
      default: null,
    },

    /**
     * Background color for text-only stories
     */
    backgroundColor: {
      type: String,
      trim: true,
      default: null,
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
     * Expiration timestamp - auto-set to 24 hours from creation
     */
    expiresAt: {
      type: Date,
      // Set automatically by pre-validate hook (24hrs from creation)
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// INDEXES
// ============================================

/**
 * TTL index - MongoDB auto-deletes documents after expiresAt
 */
challengeStorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Fetch stories for a challenge (main query pattern)
 */
challengeStorySchema.index({ challengeId: 1, isDeleted: 1, expiresAt: 1 });

/**
 * User's stories for a specific challenge
 */
challengeStorySchema.index({ userId: 1, challengeId: 1, isDeleted: 1 });

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Pre-validate: set expiresAt to 24 hours from now for new documents
 * (must be pre-validate, not pre-save, so it runs before required field checks)
 */
challengeStorySchema.pre("validate", function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

/**
 * Pre-query: exclude soft-deleted documents by default
 */
challengeStorySchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-validate: ensure mediaUrl is provided for image/video stories,
 * and caption is provided for text stories
 */
challengeStorySchema.pre("validate", function (next) {
  if (
    (this.mediaType === "image" || this.mediaType === "video") &&
    !this.mediaUrl
  ) {
    this.invalidate(
      "mediaUrl",
      "Media URL is required for image/video stories"
    );
  }
  if (this.mediaType === "text" && (!this.caption || !this.caption.trim())) {
    this.invalidate("caption", "Caption is required for text stories");
  }
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Soft delete this story
 */
challengeStorySchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

const ChallengeStory = mongoose.model("ChallengeStory", challengeStorySchema);

export default ChallengeStory;
