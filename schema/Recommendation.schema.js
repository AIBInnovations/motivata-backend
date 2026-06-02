/**
 * @fileoverview Recommendation schema - short, tagged text posts.
 * Created by members or admins; viewable by all users.
 * @module schema/Recommendation
 */

import mongoose from "mongoose";
import {
  RECOMMENDATION_TAGS,
  RECOMMENDATION_MAX_TAGS,
  RECOMMENDATION_MAX_WORDS,
  countWords,
} from "../src/Recommendation/recommendation.constants.js";

const recommendationSchema = new mongoose.Schema(
  {
    /**
     * Author type (User or Admin) - drives the dynamic reference below.
     */
    authorType: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
      default: "User",
    },

    /**
     * Author (User or Admin who created the recommendation).
     */
    author: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "authorType",
      required: true,
      index: true,
    },

    /**
     * Author display name, snapshotted at creation time for stable display.
     */
    authorName: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * Recommendation text - simple post, capped at RECOMMENDATION_MAX_WORDS words.
     */
    text: {
      type: String,
      required: [true, "Recommendation text is required"],
      trim: true,
      validate: {
        validator: (v) => countWords(v) > 0 && countWords(v) <= RECOMMENDATION_MAX_WORDS,
        message: `Recommendation must be between 1 and ${RECOMMENDATION_MAX_WORDS} words`,
      },
    },

    /**
     * Pre-defined tags (1 to RECOMMENDATION_MAX_TAGS) chosen from RECOMMENDATION_TAGS.
     */
    tags: {
      type: [String],
      required: true,
      validate: [
        {
          validator: (arr) => Array.isArray(arr) && arr.length >= 1 && arr.length <= RECOMMENDATION_MAX_TAGS,
          message: `Select between 1 and ${RECOMMENDATION_MAX_TAGS} tags`,
        },
        {
          validator: (arr) => arr.every((t) => RECOMMENDATION_TAGS.includes(t)),
          message: "One or more tags are not valid",
        },
        {
          validator: (arr) => new Set(arr).size === arr.length,
          message: "Tags must be unique",
        },
      ],
    },

    /**
     * Like count (denormalized for performance).
     */
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Comment count (denormalized for performance).
     */
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Soft delete flag.
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp.
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for performance.
 */
recommendationSchema.index({ createdAt: -1 });
recommendationSchema.index({ author: 1, createdAt: -1 });
recommendationSchema.index({ tags: 1, createdAt: -1 });
recommendationSchema.index({ isDeleted: 1, createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted recommendations by default.
 */
recommendationSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Instance method for soft delete.
 * validateModifiedOnly avoids re-validating unmodified fields (e.g. legacy tags
 * that are no longer in the current taxonomy) when flipping the delete flag.
 */
recommendationSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save({ validateModifiedOnly: true });
};

/**
 * Instance method to restore a soft deleted recommendation.
 */
recommendationSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save({ validateModifiedOnly: true });
};

/**
 * Static method to find deleted recommendations.
 */
recommendationSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select("+isDeleted +deletedAt");
};

const Recommendation = mongoose.model("Recommendation", recommendationSchema);

export default Recommendation;
