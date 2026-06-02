/**
 * @fileoverview PostComment schema — comments on Connect posts.
 * Any authenticated user can create; everyone can view. Author or admin can delete.
 * @module schema/PostComment
 */

import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
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
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
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

postCommentSchema.index({ post: 1, createdAt: -1 });
postCommentSchema.index({ author: 1, createdAt: -1 });
postCommentSchema.index({ isDeleted: 1 });

postCommentSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

postCommentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

const PostComment = mongoose.model("PostComment", postCommentSchema);
export default PostComment;
