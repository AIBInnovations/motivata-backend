/**
 * @fileoverview Admin club controller with CRUD operations
 * @module controllers/club/admin
 */

import Club from "../../schema/Club.schema.js";
import ClubMember from "../../schema/ClubMember.schema.js";
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
    const { name, description, thumbnail } = req.body;

    const clubData = {
      name,
      description,
      thumbnail: thumbnail || null,
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
    const { name, description, thumbnail } = req.body;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    // Update only provided fields
    if (name !== undefined) club.name = name;
    if (description !== undefined) club.description = description;
    if (thumbnail !== undefined) club.thumbnail = thumbnail || null;

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
