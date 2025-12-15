/**
 * @fileoverview Connect controller for follow/unfollow and user search
 * @module controllers/connect
 */

import Connect from "../../schema/Connect.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Follow a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    // Prevent self-follow
    if (userId === followerId) {
      return responseUtil.badRequest(res, "Cannot follow yourself");
    }

    // Check if target user exists and is not deleted
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return responseUtil.notFound(res, "User not found");
    }

    // Check if already following
    const existingFollow = await Connect.findOne({
      follower: followerId,
      following: userId,
    });

    if (existingFollow) {
      return responseUtil.conflict(res, "Already following this user");
    }

    // Create follow relationship
    const connection = new Connect({
      follower: followerId,
      following: userId,
    });

    await connection.save();

    // Update denormalized counts
    await Promise.all([
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(userId, { $inc: { followerCount: 1 } }),
    ]);

    return responseUtil.created(res, "User followed successfully", {
      connection: {
        id: connection._id,
        following: {
          id: targetUser._id,
          name: targetUser.name,
        },
      },
    });
  } catch (error) {
    console.error("[CONNECT] Follow user error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "Already following this user");
    }

    return responseUtil.internalError(res, "Failed to follow user", error.message);
  }
};

/**
 * Unfollow a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    // Prevent self-unfollow
    if (userId === followerId) {
      return responseUtil.badRequest(res, "Cannot unfollow yourself");
    }

    // Find and delete the follow relationship
    const connection = await Connect.findOneAndDelete({
      follower: followerId,
      following: userId,
    });

    if (!connection) {
      return responseUtil.notFound(res, "You are not following this user");
    }

    // Update denormalized counts (ensure they don't go below 0 using aggregation pipeline)
    await Promise.all([
      User.findByIdAndUpdate(followerId, [
        { $set: { followingCount: { $max: [0, { $subtract: ["$followingCount", 1] }] } } }
      ]),
      User.findByIdAndUpdate(userId, [
        { $set: { followerCount: { $max: [0, { $subtract: ["$followerCount", 1] }] } } }
      ]),
    ]);

    return responseUtil.success(res, "User unfollowed successfully");
  } catch (error) {
    console.error("[CONNECT] Unfollow user error:", error);
    return responseUtil.internalError(res, "Failed to unfollow user", error.message);
  }
};

/**
 * Get followers of a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    const skip = (page - 1) * limit;

    const [connections, totalCount] = await Promise.all([
      Connect.find({ following: userId })
        .populate({
          path: "follower",
          select: "name email followerCount followingCount postCount",
          match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Connect.countDocuments({ following: userId }),
    ]);

    // Filter out null followers (deleted users) and add isFollowing status
    let followingSet = new Set();
    if (currentUserId) {
      const currentUserFollowing = await Connect.find({
        follower: currentUserId,
      }).select("following");
      followingSet = new Set(
        currentUserFollowing.map((c) => c.following.toString())
      );
    }

    const followers = connections
      .filter((c) => c.follower !== null)
      .map((c) => ({
        id: c.follower._id,
        name: c.follower.name,
        email: c.follower.email,
        followerCount: c.follower.followerCount || 0,
        followingCount: c.follower.followingCount || 0,
        postCount: c.follower.postCount || 0,
        isFollowing: currentUserId
          ? followingSet.has(c.follower._id.toString())
          : false,
        followedAt: c.createdAt,
      }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Followers fetched successfully", {
      followers,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[CONNECT] Get followers error:", error);
    return responseUtil.internalError(res, "Failed to fetch followers", error.message);
  }
};

/**
 * Get users that a user is following
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    const skip = (page - 1) * limit;

    const [connections, totalCount] = await Promise.all([
      Connect.find({ follower: userId })
        .populate({
          path: "following",
          select: "name email followerCount followingCount postCount",
          match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Connect.countDocuments({ follower: userId }),
    ]);

    // Filter out null following (deleted users) and add isFollowing status
    let followingSet = new Set();
    if (currentUserId) {
      const currentUserFollowing = await Connect.find({
        follower: currentUserId,
      }).select("following");
      followingSet = new Set(
        currentUserFollowing.map((c) => c.following.toString())
      );
    }

    const following = connections
      .filter((c) => c.following !== null)
      .map((c) => ({
        id: c.following._id,
        name: c.following.name,
        email: c.following.email,
        followerCount: c.following.followerCount || 0,
        followingCount: c.following.followingCount || 0,
        postCount: c.following.postCount || 0,
        isFollowing: currentUserId
          ? followingSet.has(c.following._id.toString())
          : false,
        followedAt: c.createdAt,
      }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Following list fetched successfully", {
      following,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[CONNECT] Get following error:", error);
    return responseUtil.internalError(res, "Failed to fetch following list", error.message);
  }
};

/**
 * Search users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;

    if (!search || search.trim().length < 2) {
      return responseUtil.badRequest(
        res,
        "Search query must be at least 2 characters"
      );
    }

    const skip = (page - 1) * limit;

    // Build search query
    const searchRegex = new RegExp(search.trim(), "i");
    const query = {
      $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
      isDeleted: false,
    };

    // Exclude current user from search results
    if (currentUserId) {
      query._id = { $ne: currentUserId };
    }

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select("name email phone followerCount followingCount postCount")
        .sort({ followerCount: -1, name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    // Add isFollowing status
    let followingSet = new Set();
    if (currentUserId) {
      const currentUserFollowing = await Connect.find({
        follower: currentUserId,
      }).select("following");
      followingSet = new Set(
        currentUserFollowing.map((c) => c.following.toString())
      );
    }

    const usersWithStatus = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      followerCount: user.followerCount || 0,
      followingCount: user.followingCount || 0,
      postCount: user.postCount || 0,
      isFollowing: currentUserId ? followingSet.has(user._id.toString()) : false,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Users found", {
      users: usersWithStatus,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[CONNECT] Search users error:", error);
    return responseUtil.internalError(res, "Failed to search users", error.message);
  }
};

/**
 * Get user profile by ID (for viewing other users' profiles)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    const user = await User.findById(userId).select(
      "name email phone followerCount followingCount postCount createdAt"
    );

    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      isFollowing = await Connect.isFollowing(currentUserId, userId);
    }

    return responseUtil.success(res, "User profile fetched successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        followerCount: user.followerCount || 0,
        followingCount: user.followingCount || 0,
        postCount: user.postCount || 0,
        joinedAt: user.createdAt,
        isFollowing,
        isOwnProfile: currentUserId === userId,
      },
    });
  } catch (error) {
    console.error("[CONNECT] Get user profile error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid user ID");
    }

    return responseUtil.internalError(res, "Failed to fetch user profile", error.message);
  }
};

/**
 * Check if following a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return responseUtil.success(res, "Follow status", {
        isFollowing: false,
        isOwnProfile: true,
      });
    }

    const isFollowing = await Connect.isFollowing(currentUserId, userId);

    return responseUtil.success(res, "Follow status", {
      isFollowing,
      isOwnProfile: false,
    });
  } catch (error) {
    console.error("[CONNECT] Check follow status error:", error);
    return responseUtil.internalError(res, "Failed to check follow status", error.message);
  }
};

export default {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  getUserProfile,
  checkFollowStatus,
};
