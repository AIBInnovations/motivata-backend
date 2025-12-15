/**
 * @fileoverview Like schema for Connect social feed feature
 * @module schema/Like
 *
 * This schema tracks which users have liked which posts.
 * Used for both tracking likes and checking if a user has liked a post.
 */

import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    /**
     * The user who liked the post
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * The post that was liked
     */
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    /**
     * Soft delete flag - used when post is deleted or user deletes account
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound unique index to prevent duplicate likes
 */
likeSchema.index({ user: 1, post: 1 }, { unique: true });

/**
 * Index for getting all likes for a post
 */
likeSchema.index({ post: 1, isDeleted: 1 });

/**
 * Index for getting all likes by a user
 */
likeSchema.index({ user: 1, isDeleted: 1 });

/**
 * Pre-query middleware to exclude soft deleted likes
 */
likeSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to check if user has liked a post
 */
likeSchema.statics.hasLiked = async function (userId, postId) {
  const like = await this.findOne({
    user: userId,
    post: postId,
    isDeleted: false,
  });
  return !!like;
};

/**
 * Static method to check likes for multiple posts (for feed optimization)
 */
likeSchema.statics.hasLikedPosts = async function (userId, postIds) {
  const likes = await this.find({
    user: userId,
    post: { $in: postIds },
    isDeleted: false,
  }).select("post");

  const likedPostIds = new Set(likes.map((like) => like.post.toString()));
  return likedPostIds;
};

/**
 * Static method to get like count for a post
 */
likeSchema.statics.getLikeCount = function (postId) {
  return this.countDocuments({ post: postId, isDeleted: false });
};

/**
 * Static method to get users who liked a post
 */
likeSchema.statics.getPostLikers = function (postId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ post: postId })
    .populate({
      path: "user",
      select: "name email",
      match: { isDeleted: false },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Instance method for soft delete
 */
likeSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Static method to soft delete all likes by a user (when user deletes account)
 */
likeSchema.statics.softDeleteByUser = async function (userId) {
  return this.updateMany(
    { user: userId },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};

/**
 * Static method to soft delete all likes for a post (when post is deleted)
 */
likeSchema.statics.softDeleteByPost = async function (postId) {
  return this.updateMany(
    { post: postId },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};

const Like = mongoose.model("Like", likeSchema);

export default Like;
