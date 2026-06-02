/**
 * @fileoverview Tracks Doer bookmarks on recommendations (one per user per recommendation).
 * @module schema/RecommendationBookmark
 */

import mongoose from "mongoose";

const recommendationBookmarkSchema = new mongoose.Schema(
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

// One bookmark per user per recommendation.
recommendationBookmarkSchema.index({ recommendation: 1, user: 1 }, { unique: true });

const RecommendationBookmark = mongoose.model(
  "RecommendationBookmark",
  recommendationBookmarkSchema
);

export default RecommendationBookmark;
