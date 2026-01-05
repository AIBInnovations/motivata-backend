/**
 * @fileoverview User club controller for club operations
 * @module controllers/club/user
 *
 * Note: Users must join a club before they can:
 * - View the club feed
 * - Post in the club
 */

import Club from "../../schema/Club.schema.js";
import ClubMember from "../../schema/ClubMember.schema.js";
import Post from "../../schema/Post.schema.js";
import Like from "../../schema/Like.schema.js";
import Connect from "../../schema/Connect.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Get all clubs (public, with join status if authenticated)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated clubs
 */
export const getAllClubs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "memberCount",
      sortOrder = "desc",
    } = req.query;

    const currentUserId = req.user?.id || null;
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [clubs, totalCount] = await Promise.all([
      Club.find()
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Club.countDocuments(),
    ]);

    // If user is authenticated, get their club memberships
    let joinedClubIds = new Set();
    if (currentUserId) {
      const clubIds = clubs.map((club) => club._id);
      joinedClubIds = await ClubMember.getMembershipStatus(currentUserId, clubIds);
    }

    // Format clubs with isJoined flag
    const formattedClubs = clubs.map((club) => ({
      id: club._id,
      name: club.name,
      description: club.description,
      thumbnail: club.thumbnail,
      memberCount: club.memberCount,
      postCount: club.postCount,
      isJoined: currentUserId ? joinedClubIds.has(club._id.toString()) : false,
      createdAt: club.createdAt,
      updatedAt: club.updatedAt,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Clubs fetched successfully", {
      clubs: formattedClubs,
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
    console.error("[CLUB-USER] Get all clubs error:", error);
    return responseUtil.internalError(res, "Failed to fetch clubs", error.message);
  }
};

/**
 * Get single club details (public, with isJoined flag if authenticated)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with club details
 */
export const getClubById = async (req, res) => {
  try {
    const { clubId } = req.params;
    const currentUserId = req.user?.id || null;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Check if user is a member
    let isJoined = false;
    if (currentUserId) {
      isJoined = await ClubMember.isMember(currentUserId, clubId);
    }

    return responseUtil.success(res, "Club fetched successfully", {
      club: {
        id: club._id,
        name: club.name,
        description: club.description,
        thumbnail: club.thumbnail,
        memberCount: club.memberCount,
        postCount: club.postCount,
        isJoined,
        createdAt: club.createdAt,
        updatedAt: club.updatedAt,
      },
    });
  } catch (error) {
    console.error("[CLUB-USER] Get club by ID error:", error);
    return responseUtil.internalError(res, "Failed to fetch club", error.message);
  }
};

/**
 * Join a club
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with success message
 */
export const joinClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const userId = req.user.id;

    // Check if club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Check if already a member
    const existingMembership = await ClubMember.findOne({
      user: userId,
      club: clubId,
    });

    if (existingMembership) {
      return responseUtil.conflict(res, "Already a member of this club");
    }

    // Create membership
    const membership = new ClubMember({
      user: userId,
      club: clubId,
    });

    await membership.save();

    // Increment club member count
    await Club.findByIdAndUpdate(clubId, { $inc: { memberCount: 1 } });

    return responseUtil.created(res, "Joined club successfully", {
      memberCount: club.memberCount + 1,
    });
  } catch (error) {
    console.error("[CLUB-USER] Join club error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "Already a member of this club");
    }

    return responseUtil.internalError(res, "Failed to join club", error.message);
  }
};

/**
 * Leave a club
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with success message
 */
export const leaveClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const userId = req.user.id;

    // Check if club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Find and delete membership
    const membership = await ClubMember.findOneAndDelete({
      user: userId,
      club: clubId,
    });

    if (!membership) {
      return responseUtil.notFound(res, "You are not a member of this club");
    }

    // Decrement club member count safely
    await Club.findByIdAndUpdate(
      clubId,
      [
        {
          $set: {
            memberCount: {
              $max: [0, { $subtract: ["$memberCount", 1] }],
            },
          },
        },
      ]
    );

    return responseUtil.success(res, "Left club successfully", {
      memberCount: Math.max(0, club.memberCount - 1),
    });
  } catch (error) {
    console.error("[CLUB-USER] Leave club error:", error);
    return responseUtil.internalError(res, "Failed to leave club", error.message);
  }
};

/**
 * Helper: Format post for response (similar to post.controller.js)
 */
const formatPostResponse = (
  post,
  { currentUserId = null, likedPostIds = new Set(), followingSet = new Set() } = {}
) => {
  const authorId = post.author._id.toString();
  const isOwnPost = currentUserId ? authorId === currentUserId : false;

  return {
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
      isFollowing: currentUserId && !isOwnPost ? followingSet.has(authorId) : false,
    },
    club: post.club ? {
      id: post.club._id,
      name: post.club.name,
      thumbnail: post.club.thumbnail,
    } : null,
    isLiked: currentUserId ? likedPostIds.has(post._id.toString()) : false,
    isOwnPost,
    createdAt: post.createdAt,
  };
};

/**
 * Get club feed (posts in this club)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated posts
 */
export const getClubFeed = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id || null;
    const skip = (page - 1) * limit;

    // Check if club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Require authentication to view club feed
    if (!currentUserId) {
      return responseUtil.unauthorized(res, "You must be logged in to view club feed");
    }

    // Check if user is a member of the club
    const isMember = await ClubMember.isMember(currentUserId, clubId);
    if (!isMember) {
      return responseUtil.forbidden(res, "You must join this club to view its feed");
    }

    // Get posts in this club
    const [posts, totalCount] = await Promise.all([
      Post.find({ club: clubId })
        .populate({
          path: "author",
          select: "name email",
          match: { isDeleted: false },
        })
        .populate({
          path: "club",
          select: "name thumbnail",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments({ club: clubId }),
    ]);

    // Filter out posts with deleted authors
    const validPosts = posts.filter((post) => post.author);

    // If user is authenticated, get like status and following status
    let likedPostIds = new Set();
    let followingSet = new Set();

    if (currentUserId && validPosts.length > 0) {
      const postIds = validPosts.map((post) => post._id);
      likedPostIds = await Like.hasLikedPosts(currentUserId, postIds);

      // Get list of users the current user follows
      const following = await Connect.find({ follower: currentUserId }).distinct("following");
      followingSet = new Set(following.map((id) => id.toString()));
    }

    const formattedPosts = validPosts.map((post) =>
      formatPostResponse(post, { currentUserId, likedPostIds, followingSet })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Club feed fetched successfully", {
      posts: formattedPosts,
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
    console.error("[CLUB-USER] Get club feed error:", error);
    return responseUtil.internalError(res, "Failed to fetch club feed", error.message);
  }
};

/**
 * Get club members (paginated)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated members
 */
export const getClubMembers = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id || null;
    const skip = (page - 1) * limit;

    // Check if club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Get members
    const [memberships, totalCount] = await Promise.all([
      ClubMember.find({ club: clubId })
        .populate({
          path: "user",
          select: "name email phone followerCount followingCount postCount",
          match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ClubMember.countDocuments({ club: clubId }),
    ]);

    // Filter out null users (deleted accounts)
    const validMemberships = memberships.filter((m) => m.user);

    // If user is authenticated, get following status
    let followingSet = new Set();
    if (currentUserId && validMemberships.length > 0) {
      const userIds = validMemberships.map((m) => m.user._id);
      const following = await Connect.find({
        follower: currentUserId,
        following: { $in: userIds },
      }).distinct("following");
      followingSet = new Set(following.map((id) => id.toString()));
    }

    const formattedMembers = validMemberships.map((membership) => ({
      id: membership.user._id,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      followerCount: membership.user.followerCount,
      followingCount: membership.user.followingCount,
      postCount: membership.user.postCount,
      isFollowing: currentUserId && currentUserId !== membership.user._id.toString()
        ? followingSet.has(membership.user._id.toString())
        : false,
      joinedAt: membership.createdAt,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Club members fetched successfully", {
      members: formattedMembers,
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
    console.error("[CLUB-USER] Get club members error:", error);
    return responseUtil.internalError(res, "Failed to fetch club members", error.message);
  }
};

/**
 * Get user's joined clubs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated clubs
 */
export const getMyClubs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const skip = (page - 1) * limit;

    const [memberships, totalCount] = await Promise.all([
      ClubMember.find({ user: userId })
        .populate({
          path: "club",
          select: "name description thumbnail memberCount postCount",
          match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ClubMember.countDocuments({ user: userId }),
    ]);

    // Filter out null clubs (deleted clubs)
    const validMemberships = memberships.filter((m) => m.club);

    const formattedClubs = validMemberships.map((membership) => ({
      id: membership.club._id,
      name: membership.club.name,
      description: membership.club.description,
      thumbnail: membership.club.thumbnail,
      memberCount: membership.club.memberCount,
      postCount: membership.club.postCount,
      isJoined: true,
      joinedAt: membership.createdAt,
      createdAt: membership.club.createdAt,
      updatedAt: membership.club.updatedAt,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Joined clubs fetched successfully", {
      clubs: formattedClubs,
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
    console.error("[CLUB-USER] Get my clubs error:", error);
    return responseUtil.internalError(res, "Failed to fetch joined clubs", error.message);
  }
};
