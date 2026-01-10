/**
 * @fileoverview Admin club controller with CRUD operations
 * @module controllers/club/admin
 */

import Club from "../../schema/Club.schema.js";
import ClubMember from "../../schema/ClubMember.schema.js";
import ClubJoinRequest from "../../schema/ClubJoinRequest.schema.js";
import Post from "../../schema/Post.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Create a new club
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with created club
 */
export const createClub = async (req, res) => {
  try {
    const { name, description, thumbnail, postPermissions } = req.body;

    const clubData = {
      name,
      description,
      thumbnail: thumbnail || null,
      postPermissions: postPermissions || ['MEMBERS'],
    };

    const club = new Club(clubData);
    await club.save();

    return responseUtil.created(res, "Club created successfully", { club });
  } catch (error) {
    console.error("[CLUB-ADMIN] Create club error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "Club with this name already exists");
    }

    return responseUtil.internalError(res, "Failed to create club", error.message);
  }
};

/**
 * Get all clubs with pagination, search, and sorting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated clubs
 */
export const getAllClubs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (search) {
      query.name = new RegExp(search, "i");
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [clubs, totalCount] = await Promise.all([
      Club.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .select("+isDeleted +deletedAt"),
      Club.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Clubs fetched successfully", {
      clubs,
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
    console.error("[CLUB-ADMIN] Get all clubs error:", error);
    return responseUtil.internalError(res, "Failed to fetch clubs", error.message);
  }
};

/**
 * Get single club by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with club details
 */
export const getClubById = async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId).select("+isDeleted +deletedAt");

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    return responseUtil.success(res, "Club fetched successfully", { club });
  } catch (error) {
    console.error("[CLUB-ADMIN] Get club by ID error:", error);
    return responseUtil.internalError(res, "Failed to fetch club", error.message);
  }
};

/**
 * Update club
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated club
 */
export const updateClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { name, description, thumbnail, requiresApproval, postPermissions } = req.body;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Update only provided fields
    if (name !== undefined) club.name = name;
    if (description !== undefined) club.description = description;
    if (thumbnail !== undefined) club.thumbnail = thumbnail || null;
    if (requiresApproval !== undefined) club.requiresApproval = requiresApproval;
    if (postPermissions !== undefined) club.postPermissions = postPermissions;

    await club.save();

    return responseUtil.success(res, "Club updated successfully", { club });
  } catch (error) {
    console.error("[CLUB-ADMIN] Update club error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "Club with this name already exists");
    }

    return responseUtil.internalError(res, "Failed to update club", error.message);
  }
};

/**
 * Delete club (soft delete with cascade)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with success message
 */
export const deleteClub = async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Soft delete the club
    await club.softDelete();

    // Cascade soft delete: soft delete all posts in this club
    await Post.updateMany(
      { club: clubId },
      {
        isDeleted: true,
        deletedAt: new Date(),
      }
    );

    // Cascade soft delete: soft delete all memberships
    await ClubMember.softDeleteByClub(clubId);

    return responseUtil.success(res, "Club deleted successfully", {
      message: "Club and all associated data have been deleted",
    });
  } catch (error) {
    console.error("[CLUB-ADMIN] Delete club error:", error);
    return responseUtil.internalError(res, "Failed to delete club", error.message);
  }
};

/**
 * Get club statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with club statistics
 */
export const getClubStats = async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Get recent posts count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPostsCount = await Post.countDocuments({
      club: clubId,
      createdAt: { $gte: sevenDaysAgo },
    });

    // Get top posters in this club (top 5)
    const topPosters = await Post.aggregate([
      { $match: { club: clubId, isDeleted: false } },
      { $group: { _id: "$author", postCount: { $sum: 1 } } },
      { $sort: { postCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          postCount: 1,
        },
      },
    ]);

    return responseUtil.success(res, "Club statistics fetched successfully", {
      stats: {
        clubId: club._id,
        clubName: club.name,
        totalMembers: club.memberCount,
        totalPosts: club.postCount,
        recentPosts: recentPostsCount,
        topPosters,
      },
    });
  } catch (error) {
    console.error("[CLUB-ADMIN] Get club stats error:", error);
    return responseUtil.internalError(res, "Failed to fetch club statistics", error.message);
  }
};

/**
 * Update club approval setting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated club
 */
export const updateClubApprovalSetting = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { requiresApproval } = req.body;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    club.requiresApproval = requiresApproval;
    await club.save();

    return responseUtil.success(res, "Club approval setting updated successfully", {
      club: {
        id: club._id,
        name: club.name,
        requiresApproval: club.requiresApproval,
      },
    });
  } catch (error) {
    console.error("[CLUB-ADMIN] Update approval setting error:", error);
    return responseUtil.internalError(res, "Failed to update approval setting", error.message);
  }
};

/**
 * Update club post permission setting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated club
 */
export const updateClubPostPermission = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { postPermissions } = req.body;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    club.postPermissions = postPermissions;
    await club.save();

    return responseUtil.success(res, "Club post permissions updated successfully", {
      club: {
        id: club._id,
        name: club.name,
        postPermissions: club.postPermissions,
      },
    });
  } catch (error) {
    console.error("[CLUB-ADMIN] Update post permissions error:", error);
    return responseUtil.internalError(res, "Failed to update post permissions", error.message);
  }
};

/**
 * Get all club join requests (with filters)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated join requests
 */
export const getAllJoinRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, clubId, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }
    if (clubId) {
      filter.club = clubId;
    }

    const [requests, totalCount] = await Promise.all([
      ClubJoinRequest.find(filter)
        .populate({
          path: 'user',
          select: 'name email phone',
          match: search ? { name: new RegExp(search, 'i') } : { isDeleted: false },
        })
        .populate({
          path: 'club',
          select: 'name description thumbnail',
          match: { isDeleted: false },
        })
        .populate({
          path: 'reviewedBy',
          select: 'name email',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ClubJoinRequest.countDocuments(filter),
    ]);

    // Filter out requests with deleted users or clubs
    const validRequests = requests.filter((r) => r.user && r.club);

    const formattedRequests = validRequests.map((request) => ({
      id: request._id,
      user: {
        id: request.user._id,
        name: request.user.name,
        email: request.user.email,
        phone: request.user.phone,
      },
      club: {
        id: request.club._id,
        name: request.club.name,
        description: request.club.description,
        thumbnail: request.club.thumbnail,
      },
      status: request.status,
      userNote: request.userNote,
      rejectionReason: request.rejectionReason,
      adminNotes: request.adminNotes,
      reviewedBy: request.reviewedBy ? {
        id: request.reviewedBy._id,
        name: request.reviewedBy.name,
        email: request.reviewedBy.email,
      } : null,
      reviewedAt: request.reviewedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Join requests fetched successfully', {
      requests: formattedRequests,
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
    console.error('[CLUB-ADMIN] Get all join requests error:', error);
    return responseUtil.internalError(res, 'Failed to fetch join requests', error.message);
  }
};

/**
 * Approve club join request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with success message
 */
export const approveJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    const joinRequest = await ClubJoinRequest.findById(requestId);

    if (!joinRequest) {
      return responseUtil.notFound(res, "Join request not found");
    }

    if (joinRequest.status !== 'PENDING') {
      return responseUtil.conflict(res, `Join request is already ${joinRequest.status.toLowerCase()}`);
    }

    // Check if club exists
    const club = await Club.findById(joinRequest.club);
    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Check if user is already a member
    const existingMembership = await ClubMember.findOne({
      user: joinRequest.user,
      club: joinRequest.club,
    });

    if (existingMembership && existingMembership.status === 'APPROVED') {
      return responseUtil.conflict(res, "User is already a member of this club");
    }

    // Approve the join request
    await joinRequest.approve(adminId, adminNotes);

    // Create club membership
    const membership = new ClubMember({
      user: joinRequest.user,
      club: joinRequest.club,
      status: 'APPROVED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });

    await membership.save();

    // Increment club member count
    await Club.findByIdAndUpdate(joinRequest.club, { $inc: { memberCount: 1 } });

    return responseUtil.success(res, "Join request approved successfully", {
      requestId: joinRequest._id,
      status: 'APPROVED',
      memberCount: club.memberCount + 1,
    });
  } catch (error) {
    console.error('[CLUB-ADMIN] Approve join request error:', error);
    return responseUtil.internalError(res, 'Failed to approve join request', error.message);
  }
};

/**
 * Reject club join request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with success message
 */
export const rejectJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user.id;

    const joinRequest = await ClubJoinRequest.findById(requestId);

    if (!joinRequest) {
      return responseUtil.notFound(res, "Join request not found");
    }

    if (joinRequest.status !== 'PENDING') {
      return responseUtil.conflict(res, `Join request is already ${joinRequest.status.toLowerCase()}`);
    }

    // Reject the join request
    await joinRequest.reject(adminId, rejectionReason, adminNotes);

    return responseUtil.success(res, "Join request rejected successfully", {
      requestId: joinRequest._id,
      status: 'REJECTED',
      rejectionReason,
    });
  } catch (error) {
    console.error('[CLUB-ADMIN] Reject join request error:', error);
    return responseUtil.internalError(res, 'Failed to reject join request', error.message);
  }
};
