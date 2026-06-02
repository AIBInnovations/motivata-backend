/**
 * @fileoverview Tracks user likes on recommendations (one per user per recommendation).
 * @module schema/RecommendationLike
 */

import mongoose from "mongoose";

const recommendationLikeSchema = new mongoose.Schema(
  {
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recommendation",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// One like per user per recommendation.
recommendationLikeSchema.index({ recommendation: 1, user: 1 }, { unique: true });

const RecommendationLike = mongoose.model("RecommendationLike", recommendationLikeSchema);

export default RecommendationLike;
