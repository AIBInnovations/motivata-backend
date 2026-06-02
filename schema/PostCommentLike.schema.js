/**
 * @fileoverview Tracks user likes on post comments (one per user per comment).
 * @module schema/PostCommentLike
 */

import mongoose from "mongoose";

const postCommentLikeSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostComment",
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
postCommentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });

const PostCommentLike = mongoose.model("PostCommentLike", postCommentLikeSchema);
export default PostCommentLike;
