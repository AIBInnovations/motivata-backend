/**
 * @fileoverview Tracks user likes on recommendation comments (one per user per comment).
 * @module schema/RecommendationCommentLike
 */

import mongoose from "mongoose";

const recommendationCommentLikeSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecommendationComment",
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

// One like per user per comment.
recommendationCommentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });

const RecommendationCommentLike = mongoose.model(
  "RecommendationCommentLike",
  recommendationCommentLikeSchema
);
export default RecommendationCommentLike;
