/**
 * @fileoverview StoryView schema for tracking unique story views
 * @module schema/StoryView
 *
 * Tracks which users have viewed which stories to prevent duplicate view counts.
 */

import mongoose from "mongoose";

const storyViewSchema = new mongoose.Schema(
  {
    /**
     * The story that was viewed
     */
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
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
     * Timestamp of the view
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

/**
 * Compound index for unique user-story combination
 */
storyViewSchema.index({ storyId: 1, userId: 1 }, { unique: true });

/**
 * Index for querying views by story
 */
storyViewSchema.index({ storyId: 1 });

/**
 * Index for querying views by user
 */
storyViewSchema.index({ userId: 1 });

/**
 * Static method to record a view (returns true if new view, false if already viewed)
 */
storyViewSchema.statics.recordView = async function (storyId, userId) {
  try {
    await this.create({ storyId, userId });
    return true; // New view
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - user already viewed this story
      return false;
    }
    throw error;
  }
};

/**
 * Static method to check if user has viewed a story
 */
storyViewSchema.statics.hasViewed = async function (storyId, userId) {
  const view = await this.findOne({ storyId, userId });
  return !!view;
};

const StoryView = mongoose.model("StoryView", storyViewSchema);

export default StoryView;
