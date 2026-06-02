/**
 * @fileoverview RecommendationComment schema — short comments on recommendations.
 * Members & admins can create; all authenticated users can view & like.
 * @module schema/RecommendationComment
 */

import mongoose from "mongoose";
import { COMMENT_MAX_WORDS, countWords } from "../src/Recommendation/recommendation.constants.js";

const recommendationCommentSchema = new mongoose.Schema(
  {
    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recommendation",
      required: true,
      index: true,
    },
    authorType: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
      default: "User",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "authorType",
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      trim: true,
      default: "",
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      validate: {
        validator: (v) => countWords(v) >= 1 && countWords(v) <= COMMENT_MAX_WORDS,
        message: `Comment must be between 1 and ${COMMENT_MAX_WORDS} words`,
      },
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
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

recommendationCommentSchema.index({ recommendation: 1, likeCount: -1, createdAt: -1 });
recommendationCommentSchema.index({ author: 1, createdAt: -1 });
recommendationCommentSchema.index({ isDeleted: 1 });

recommendationCommentSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

recommendationCommentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

const RecommendationComment = mongoose.model("RecommendationComment", recommendationCommentSchema);
export default RecommendationComment;
