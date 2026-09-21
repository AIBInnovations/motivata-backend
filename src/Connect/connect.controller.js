/**
 * @fileoverview Connect controller for follow/unfollow and user search
 * @module controllers/connect
 */

import Connect from "../../schema/Connect.schema.js";
import User from "../../schema/User.schema.js";
import Post from "../../schema/Post.schema.js";
import Like from "../../schema/Like.schema.js";
import ClubMember from "../../schema/ClubMember.schema.js";
import responseUtil from "../../utils/response.util.js";
import { notifyUsers } from "../../services/userNotification.service.js";
import { computeGrowthScore, getProfileSections } from "../../services/profileInsights.service.js";

const PRIVACY_FIELDS = [
  "showOccupation",
  "showAge",
  "showBio",
  "showPosts",
  "showChallenges",
  "showOpportunities",
  "showEvents",
  "showClubs",
  "showSosReports",
  "showGrowthScore",
];

const PRIVACY_DEFAULT_OFF = new Set(["showSosReports"]);

const privacyFlags = (privacy = {}) =>
  Object.fromEntries(
    PRIVACY_FIELDS.map((key) => [
      key,
      PRIVACY_DEFAULT_OFF.has(key) ? privacy?.[key] === true : privacy?.[key] !== false,
    ])
  );

const findEdge = (follower, following) =>
  Connect.findOne({ follower, following }).setOptions({ includePending: true });

const adjustCounts = async (followerId, followingId, delta) => {
  if (delta > 0) {
    await Promise.all([
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(followingId, { $inc: { followerCount: 1 } }),
    ]);
    return;
  }
  await Promise.all([
    User.findByIdAndUpdate(followerId, [
      { $set: { followingCount: { $max: [0, { $subtract: ["$followingCount", 1] }] } } },
    ]),
    User.findByIdAndUpdate(followingId, [
      { $set: { followerCount: { $max: [0, { $subtract: ["$followerCount", 1] }] } } },
    ]),
  ]);
};

const acceptEdge = async (edge) => {
  if (edge.status !== "PENDING") return false;
  edge.status = "ACCEPTED";
  edge.respondedAt = new Date();
  await edge.save();
  await adjustCounts(edge.follower, edge.following, 1);
  return true;
};

const ensureAcceptedEdge = async (followerId, followingId) => {
  const existing = await findEdge(followerId, followingId);
  if (existing) {
    await acceptEdge(existing);
    return;
  }
  try {
    await Connect.create({ follower: followerId, following: followingId, status: "ACCEPTED", respondedAt: new Date() });
    await adjustCounts(followerId, followingId, 1);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
};

export const getConnectionStatusMap = async (currentUserId, otherIds) => {
  const map = new Map();
  if (!currentUserId || otherIds.length === 0) return map;
  const ids = otherIds.map(String);
  const edges = await Connect.find({
    $or: [
      { follower: currentUserId, following: { $in: ids } },
      { following: currentUserId, follower: { $in: ids } },
    ],
  })
    .setOptions({ includePending: true })
    .select("follower following status")
    .lean();

  ids.forEach((id) => map.set(id, "NONE"));
  edges.forEach((edge) => {
    const outgoing = String(edge.follower) === String(currentUserId);
    const other = outgoing ? String(edge.following) : String(edge.follower);
    const current = map.get(other);
    if (edge.status !== "PENDING") {
      map.set(other, "CONNECTED");
    } else if (current !== "CONNECTED") {
      map.set(other, outgoing ? "REQUESTED" : "INCOMING");
    }
  });
  return map;
};

export const getConnectionStatus = async (currentUserId, otherId) => {
  const map = await getConnectionStatusMap(currentUserId, [otherId]);
  return map.get(String(otherId)) || "NONE";
};

/**
 * Follow a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user.id;

    if (userId === requesterId) {
      return responseUtil.badRequest(res, "Cannot connect with yourself");
    }

    const [targetUser, requester] = await Promise.all([
      User.findById(userId).select("name"),
      User.findById(requesterId).select("name"),
    ]);
    if (!targetUser) {
      return responseUtil.notFound(res, "User not found");
    }

    const [outgoing, incoming] = await Promise.all([findEdge(requesterId, userId), findEdge(userId, requesterId)]);

    if ((outgoing && outgoing.status !== "PENDING") || (incoming && incoming.status !== "PENDING")) {
      return responseUtil.conflict(res, "You are already connected");
    }

    if (incoming && incoming.status === "PENDING") {
      await acceptEdge(incoming);
      await ensureAcceptedEdge(requesterId, userId);
      notifyUsers({
        userIds: [userId],
        category: "CONNECTIONS",
        type: "CONNECTION_ACCEPTED",
        title: "New connection",
        body: `${requester?.name || "Someone"} accepted your connection request.`,
        data: { screen: "UserProfile", userId: String(requesterId) },
      });
      return responseUtil.success(res, "You are now connected", {
        connectionStatus: "CONNECTED",
        connection: { following: { id: targetUser._id, name: targetUser.name } },
      });
    }

    if (outgoing && outgoing.status === "PENDING") {
      return responseUtil.conflict(res, "Connection request already sent");
    }

    const connection = await Connect.create({ follower: requesterId, following: userId, status: "PENDING" });

    notifyUsers({
      userIds: [userId],
      category: "CONNECTIONS",
      type: "CONNECTION_REQUEST",
      title: "New connection request",
      body: `${requester?.name || "Someone"} wants to connect with you.`,
      data: { screen: "ConnectionRequests", userId: String(requesterId) },
    });

    return responseUtil.created(res, "Connection request sent", {
      connectionStatus: "REQUESTED",
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
      return responseUtil.conflict(res, "Connection request already sent");
    }

    return responseUtil.internalError(res, "Failed to send connection request", error.message);
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
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return responseUtil.badRequest(res, "Cannot unfollow yourself");
    }

    const edges = await Connect.find({
      $or: [
        { follower: currentUserId, following: userId },
        { follower: userId, following: currentUserId },
      ],
    }).setOptions({ includePending: true });

    const removable = edges.filter(
      (edge) => edge.status !== "PENDING" || String(edge.follower) === String(currentUserId)
    );

    if (removable.length === 0) {
      return responseUtil.notFound(res, "You are not connected with this user");
    }

    for (const edge of removable) {
      await Connect.deleteOne({ _id: edge._id });
      if (edge.status !== "PENDING") {
        await adjustCounts(edge.follower, edge.following, -1);
      }
    }

    const onlyCancelledRequest = removable.every((edge) => edge.status === "PENDING");
    return responseUtil.success(res, onlyCancelledRequest ? "Connection request cancelled" : "Connection removed", {
      connectionStatus: "NONE",
    });
  } catch (error) {
    console.error("[CONNECT] Unfollow user error:", error);
    return responseUtil.internalError(res, "Failed to remove connection", error.message);
  }
};

export const getConnectionRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const direction = req.query.direction === "outgoing" ? "outgoing" : "incoming";
    const query =
      direction === "incoming"
        ? { following: currentUserId, status: "PENDING" }
        : { follower: currentUserId, status: "PENDING" };

    const requests = await Connect.find(query)
      .populate({
        path: direction === "incoming" ? "follower" : "following",
        select: "name occupation occupationCategory city bio isDeleted",
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const users = requests
      .map((r) => ({ request: r, user: direction === "incoming" ? r.follower : r.following }))
      .filter(({ user }) => user && !user.isDeleted)
      .map(({ request, user }) => ({
        requestId: request._id,
        user: {
          id: user._id,
          name: user.name,
          occupation: user.occupation || null,
          occupationCategory: user.occupationCategory || null,
          city: user.city || null,
          bio: user.bio || null,
        },
        requestedAt: request.createdAt,
      }));

    return responseUtil.success(res, "Connection requests fetched", {
      direction,
      requests: users,
      count: users.length,
    });
  } catch (error) {
    console.error("[CONNECT] Get requests error:", error);
    return responseUtil.internalError(res, "Failed to fetch connection requests", error.message);
  }
};

export const respondToConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const action = req.body?.action;

    if (action !== "accept" && action !== "decline") {
      return responseUtil.badRequest(res, "Action must be accept or decline");
    }

    const edge = await Connect.findOne({ follower: userId, following: currentUserId, status: "PENDING" });
    if (!edge) {
      return responseUtil.notFound(res, "No pending request from this user");
    }

    if (action === "decline") {
      await Connect.deleteOne({ _id: edge._id });
      return responseUtil.success(res, "Request declined", { connectionStatus: "NONE" });
    }

    await acceptEdge(edge);
    await ensureAcceptedEdge(currentUserId, userId);

    const me = await User.findById(currentUserId).select("name").lean();
    notifyUsers({
      userIds: [userId],
      category: "CONNECTIONS",
      type: "CONNECTION_ACCEPTED",
      title: "New connection",
      body: `${me?.name || "Someone"} accepted your connection request.`,
      data: { screen: "UserProfile", userId: String(currentUserId) },
    });

    return responseUtil.success(res, "You are now connected", { connectionStatus: "CONNECTED" });
  } catch (error) {
    console.error("[CONNECT] Respond to request error:", error);
    return responseUtil.internalError(res, "Failed to respond to request", error.message);
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
    const { search = "", city, occupation, occupationCategory, clubId, page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;
    const trimmed = String(search || "").trim();
    const hasFilter = !!(city || occupation || occupationCategory || clubId);

    if (!hasFilter && trimmed.length < 2) {
      return responseUtil.badRequest(
        res,
        "Search query must be at least 2 characters"
      );
    }

    const skip = (page - 1) * limit;
    const escape = (value) => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const query = { isDeleted: false };

    if (trimmed) {
      const searchRegex = new RegExp(escape(trimmed), "i");
      const numericValue = Number(trimmed);
      const orConditions = [
        { name: searchRegex },
        { occupation: searchRegex },
        { occupationCategory: searchRegex },
        { city: searchRegex },
        { bio: searchRegex },
      ];
      if (!isNaN(numericValue) && trimmed !== "") {
        orConditions.push({ age: numericValue });
      }
      query.$or = orConditions;
    }

    if (city) query.city = new RegExp(`^${escape(city)}$`, "i");
    if (occupationCategory) query.occupationCategory = new RegExp(`^${escape(occupationCategory)}$`, "i");
    if (occupation) query.occupation = new RegExp(escape(occupation), "i");

    if (clubId) {
      const memberIds = await ClubMember.find({ club: clubId, status: "APPROVED", isDeleted: false }).distinct("user");
      query._id = { $in: memberIds };
    }

    if (currentUserId) {
      query._id = query._id ? { ...query._id, $ne: currentUserId } : { $ne: currentUserId };
    }

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select("name occupation occupationCategory city age bio followerCount followingCount postCount privacySettings createdAt")
        .sort({ followerCount: -1, name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    const statusMap = await getConnectionStatusMap(currentUserId, users.map((u) => u._id));

    const usersWithStatus = users.map((user) => {
      const privacy = privacyFlags(user.privacySettings);
      const connectionStatus = statusMap.get(String(user._id)) || "NONE";
      return {
        id: user._id,
        name: user.name,
        occupation: privacy.showOccupation ? user.occupation || null : null,
        occupationCategory: privacy.showOccupation ? user.occupationCategory || null : null,
        city: user.city || null,
        age: privacy.showAge ? user.age || null : null,
        bio: privacy.showBio ? user.bio || null : null,
        followerCount: user.followerCount || 0,
        followingCount: user.followingCount || 0,
        postCount: user.postCount || 0,
        connectionStatus,
        isFollowing: connectionStatus === "CONNECTED",
        isOwnProfile: false,
        joinedAt: user.createdAt,
      };
    });

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
 * Includes user info and their recent posts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { postsLimit = 10 } = req.query;
    const currentUserId = req.user?.id;

    const user = await User.findById(userId).select(
      "name occupation occupationCategory city age bio achievement lifeExperiences followerCount followingCount postCount privacySettings createdAt"
    );

    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    const isOwnProfile = currentUserId === userId;
    const privacy = privacyFlags(user.privacySettings);
    const connectionStatus = isOwnProfile ? "SELF" : await getConnectionStatus(currentUserId, userId);
    const isConnected = connectionStatus === "CONNECTED";
    const canSee = (flag) => isOwnProfile || (isConnected && privacy[flag]);

    let formattedPosts = [];
    if (isOwnProfile || privacy.showPosts) {
      const posts = await Post.find({ author: userId })
        .populate("author", "name email")
        .sort({ createdAt: -1 })
        .limit(Number(postsLimit));

      let likedPostIds = new Set();
      if (currentUserId) {
        likedPostIds = await Like.hasLikedPosts(currentUserId, posts.map((p) => p._id));
      }

      formattedPosts = posts.map((post) => ({
        id: post._id,
        caption: post.caption,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        mediaThumbnail: post.mediaThumbnail,
        likeCount: post.likeCount,
        shareCount: post.shareCount,
        author: {
          id: post.author._id,
          name: post.author.name,
          isFollowing: currentUserId && !isOwnProfile ? isConnected : false,
        },
        isLiked: currentUserId ? likedPostIds.has(post._id.toString()) : false,
        isOwnPost: isOwnProfile,
        createdAt: post.createdAt,
      }));
    }

    const needsSections =
      isOwnProfile ||
      (isConnected &&
        (privacy.showChallenges || privacy.showOpportunities || privacy.showEvents || privacy.showClubs || privacy.showSosReports));
    const [sections, growthScore] = await Promise.all([
      needsSections ? getProfileSections(userId) : Promise.resolve(null),
      canSee("showGrowthScore") ? computeGrowthScore(userId) : Promise.resolve(null),
    ]);

    const userObj = {
      id: user._id,
      name: user.name,
      city: user.city || null,
      followerCount: user.followerCount || 0,
      followingCount: user.followingCount || 0,
      postCount: user.postCount || 0,
      joinedAt: user.createdAt,
      connectionStatus,
      isFollowing: isConnected,
      isOwnProfile,
      ...(isOwnProfile || privacy.showOccupation
        ? { occupation: user.occupation || null, occupationCategory: user.occupationCategory || null }
        : {}),
      ...(isOwnProfile || privacy.showAge ? { age: user.age || null } : {}),
      ...(isOwnProfile || privacy.showBio
        ? { bio: user.bio || null, achievement: user.achievement || null, lifeExperiences: user.lifeExperiences || [] }
        : {}),
      ...(isOwnProfile ? { privacySettings: privacy } : {}),
    };

    return responseUtil.success(res, "User profile fetched successfully", {
      user: userObj,
      posts: formattedPosts,
      sections: sections
        ? {
            challenges: canSee("showChallenges") ? sections.challenges : null,
            opportunities: canSee("showOpportunities") ? sections.opportunities : null,
            events: canSee("showEvents") ? sections.events : null,
            clubs: canSee("showClubs") ? sections.clubs : null,
            sosReports: canSee("showSosReports") ? sections.sosReports : null,
          }
        : null,
      growthScore,
      sectionsLockedReason: !isOwnProfile && !isConnected ? "CONNECT_TO_SEE" : null,
    });
  } catch (error) {
    console.error("[CONNECT] Get user profile error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid user ID");
    }

    return responseUtil.internalError(res, "Failed to fetch user profile", error.message);
  }
};

export const getMyGrowthScore = async (req, res) => {
  try {
    const growthScore = await computeGrowthScore(req.user.id);
    return responseUtil.success(res, "Growth score fetched", { growthScore });
  } catch (error) {
    console.error("[CONNECT] Growth score error:", error);
    return responseUtil.internalError(res, "Failed to calculate growth score", error.message);
  }
};

export const openUserDeepLink = async (req, res) => {
  const { userId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
    return res.redirect("motivata://");
  }
  return res.redirect(`motivata://user/${userId}`);
};

/**
 * Update current user's privacy settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updatePrivacySettings = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const update = {};
    PRIVACY_FIELDS.forEach((key) => {
      if (req.body?.[key] !== undefined) update[`privacySettings.${key}`] = Boolean(req.body[key]);
    });

    if (Object.keys(update).length === 0) {
      return responseUtil.badRequest(res, "No privacy settings provided");
    }

    const user = await User.findByIdAndUpdate(
      currentUserId,
      { $set: update },
      { new: true, select: "privacySettings" }
    );

    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    return responseUtil.success(res, "Privacy settings updated", {
      privacySettings: privacyFlags(user.privacySettings),
    });
  } catch (error) {
    console.error("[CONNECT] Update privacy settings error:", error);
    return responseUtil.internalError(res, "Failed to update privacy settings", error.message);
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
        connectionStatus: "SELF",
      });
    }

    const connectionStatus = await getConnectionStatus(currentUserId, userId);

    return responseUtil.success(res, "Follow status", {
      isFollowing: connectionStatus === "CONNECTED",
      isOwnProfile: false,
      connectionStatus,
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
  getConnectionRequests,
  respondToConnectionRequest,
  getMyGrowthScore,
  openUserDeepLink,
};
