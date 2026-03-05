/**
 * @fileoverview ChallengeStoryView schema for tracking unique story views
 * @module schema/ChallengeStoryView
 *
 * Tracks which users have viewed which challenge stories.
 * Unique constraint prevents duplicate view records per user/story pair.
 * Auto-cleans up via TTL index (48hrs after view, since stories last 24hrs).
 */

import mongoose from "mongoose";

const challengeStoryViewSchema = new mongoose.Schema(
  {
    /**
     * The story that was viewed
     */
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChallengeStory",
      required: true,
    },

    /**
     * The user who viewed the story
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * When the story was viewed
     */
    viewedAt: {
      type: Date,
      default: Date.now,
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
 * Unique constraint: one view record per user per story
 */
challengeStoryViewSchema.index({ storyId: 1, userId: 1 }, { unique: true });

/**
 * Query views by story
 */
challengeStoryViewSchema.index({ storyId: 1 });

/**
 * Query views by user
 */
challengeStoryViewSchema.index({ userId: 1 });

/**
 * TTL index: auto-cleanup 48 hours after view
 * Since stories last 24hrs, this ensures orphaned view records are cleaned up
 */
challengeStoryViewSchema.index(
  { viewedAt: 1 },
  { expireAfterSeconds: 48 * 3600 }
);

// ============================================
// STATIC METHODS
// ============================================

/**
 * Record a view for a story by a user.
 * Uses create() with duplicate key error handling for idempotency.
 * @param {ObjectId} storyId - The story ID
 * @param {ObjectId} userId - The viewing user's ID
 * @returns {boolean} true if this is a new view, false if already viewed
 */
challengeStoryViewSchema.statics.recordView = async function (
  storyId,
  userId
) {
  try {
    await this.create({ storyId, userId });
    return true; // New view
  } catch (error) {
    if (error.code === 11000) {
      return false; // Already viewed
    }
    throw error;
  }
};

const ChallengeStoryView = mongoose.model(
  "ChallengeStoryView",
  challengeStoryViewSchema
);

export default ChallengeStoryView;
