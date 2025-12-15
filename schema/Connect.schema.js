/**
 * @fileoverview Follow/Connection schema for Connect social feature
 * @module schema/Connect
 *
 * This schema represents follower relationships between users.
 * - follower: The user who is following
 * - following: The user being followed
 */

import mongoose from "mongoose";

const connectSchema = new mongoose.Schema(
  {
    /**
     * The user who is following (follower)
     */
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * The user being followed (following)
     */
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * Soft delete flag - used when either user deletes their account
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
 * Compound unique index to prevent duplicate follows
 */
connectSchema.index({ follower: 1, following: 1 }, { unique: true });

/**
 * Index for getting followers of a user
 */
connectSchema.index({ following: 1, isDeleted: 1 });

/**
 * Index for getting users that someone follows
 */
connectSchema.index({ follower: 1, isDeleted: 1 });

/**
 * Pre-query middleware to exclude soft deleted connections
 */
connectSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save validation: prevent self-follow
 */
connectSchema.pre("save", function (next) {
  if (this.follower.toString() === this.following.toString()) {
    return next(new Error("Cannot follow yourself"));
  }
  next();
});

/**
 * Static method to check if user A follows user B
 */
connectSchema.statics.isFollowing = async function (followerId, followingId) {
  const connection = await this.findOne({
    follower: followerId,
    following: followingId,
    isDeleted: false,
  });
  return !!connection;
};

/**
 * Static method to get followers of a user
 */
connectSchema.statics.getFollowers = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ following: userId })
    .populate({
      path: "follower",
      select: "name email phone",
      match: { isDeleted: false },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to get users that someone follows
 */
connectSchema.statics.getFollowing = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ follower: userId })
    .populate({
      path: "following",
      select: "name email phone",
      match: { isDeleted: false },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to get follower count
 */
connectSchema.statics.getFollowerCount = function (userId) {
  return this.countDocuments({ following: userId, isDeleted: false });
};

/**
 * Static method to get following count
 */
connectSchema.statics.getFollowingCount = function (userId) {
  return this.countDocuments({ follower: userId, isDeleted: false });
};

/**
 * Instance method for soft delete
 */
connectSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Static method to soft delete all connections for a user (when user deletes account)
 */
connectSchema.statics.softDeleteByUser = async function (userId) {
  return this.updateMany(
    {
      $or: [{ follower: userId }, { following: userId }],
    },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};

/**
 * Static method to get mutual followers (users who follow each other)
 */
connectSchema.statics.getMutualFollowers = async function (userId1, userId2) {
  const [user1Followers, user2Followers] = await Promise.all([
    this.find({ following: userId1 }).distinct("follower"),
    this.find({ following: userId2 }).distinct("follower"),
  ]);

  const user1FollowerSet = new Set(user1Followers.map((id) => id.toString()));
  return user2Followers.filter((id) => user1FollowerSet.has(id.toString()));
};

const Connect = mongoose.model("Connect", connectSchema);

export default Connect;
