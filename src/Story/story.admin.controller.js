/**
 * @fileoverview Admin Story Controller
 * @module Story/admin.controller
 *
 * Handles all admin operations for stories.
 * Only admins can create, update, and delete stories.
 */

import Story, { TTL_OPTIONS } from "../../schema/Story.schema.js";
import cloudinary from "../../config/cloudinary.config.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Create a new story
 * POST /api/web/stories
 */
export const createStory = async (req, res) => {
  try {
    const { title, mediaUrl, mediaType, cloudinaryPublicId, ttl, displayOrder } =
      req.body;
    const adminId = req.admin._id;

    // Validate required fields
    if (!mediaUrl) {
      return responseUtil.badRequest(res, "mediaUrl is required");
    }

    if (!mediaType) {
      return responseUtil.badRequest(res, "mediaType is required");
    }

    if (!["image", "video"].includes(mediaType)) {
      return responseUtil.badRequest(
        res,
        "mediaType must be either 'image' or 'video'"
      );
    }

    // Validate TTL if provided
    if (ttl && !TTL_OPTIONS.includes(ttl)) {
      return responseUtil.badRequest(res, `Invalid TTL. Must be one of: ${TTL_OPTIONS.join(", ")}`);
    }

    const story = new Story({
      title: title || null,
      mediaUrl,
      mediaType,
      cloudinaryPublicId: cloudinaryPublicId || null,
      createdBy: adminId,
      ttl: ttl || "1_day",
      displayOrder: displayOrder || 0,
    });

    await story.save();

    console.log(`[STORY] Created story ${story._id} by admin ${adminId}`);

    return responseUtil.created(res, "Story created successfully", story);
  } catch (error) {
    console.error("[STORY] Create error:", error.message);
    return responseUtil.internalError(res, "Failed to create story", error.message);
  }
};

/**
 * Get all stories (admin view - includes inactive and all metadata)
 * GET /api/web/stories
 */
export const getAllStories = async (req, res) => {
  try {
    const { page = 1, limit = 20, includeExpired = false } = req.query;

    const stories = await Story.getAllStoriesForAdmin({
      page: parseInt(page),
      limit: parseInt(limit),
      includeExpired: includeExpired === "true",
    });

    const now = new Date();
    const totalQuery = { isDeleted: false };
    if (includeExpired !== "true") {
      totalQuery.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
    }
    const total = await Story.countDocuments(totalQuery);

    return responseUtil.success(res, "Stories fetched successfully", {
      stories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[STORY] Get all error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch stories", error.message);
  }
};

/**
 * Get a single story by ID
 * GET /api/web/stories/:storyId
 */
export const getStoryById = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId).populate(
      "createdBy",
      "name username"
    );

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    return responseUtil.success(res, "Story fetched successfully", story);
  } catch (error) {
    console.error("[STORY] Get by ID error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch story", error.message);
  }
};

/**
 * Update a story
 * PUT /api/web/stories/:storyId
 */
export const updateStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { title, mediaUrl, mediaType, cloudinaryPublicId, ttl, isActive, displayOrder } =
      req.body;

    const story = await Story.findById(storyId);

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    // Build update object
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
    if (mediaType !== undefined) {
      if (!["image", "video"].includes(mediaType)) {
        return responseUtil.badRequest(
          res,
          "mediaType must be either 'image' or 'video'"
        );
      }
      updateData.mediaType = mediaType;
    }
    if (cloudinaryPublicId !== undefined)
      updateData.cloudinaryPublicId = cloudinaryPublicId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    // Handle TTL update
    if (ttl !== undefined) {
      if (!TTL_OPTIONS.includes(ttl)) {
        return responseUtil.badRequest(
          res,
          `Invalid TTL. Must be one of: ${TTL_OPTIONS.join(", ")}`
        );
      }
      updateData.ttl = ttl;

      // Recalculate expiresAt
      const TTL_PRESETS = {
        "1_hour": 60 * 60 * 1000,
        "6_hours": 6 * 60 * 60 * 1000,
        "12_hours": 12 * 60 * 60 * 1000,
        "1_day": 24 * 60 * 60 * 1000,
        "3_days": 3 * 24 * 60 * 60 * 1000,
        "7_days": 7 * 24 * 60 * 60 * 1000,
        "30_days": 30 * 24 * 60 * 60 * 1000,
        forever: null,
      };
      const ttlMs = TTL_PRESETS[ttl];
      updateData.expiresAt = ttlMs === null ? null : new Date(Date.now() + ttlMs);
    }

    const updatedStory = await Story.findByIdAndUpdate(storyId, updateData, {
      new: true,
    }).populate("createdBy", "name username");

    console.log(`[STORY] Updated story ${storyId}`);

    return responseUtil.success(res, "Story updated successfully", updatedStory);
  } catch (error) {
    console.error("[STORY] Update error:", error.message);
    return responseUtil.internalError(res, "Failed to update story", error.message);
  }
};

/**
 * Delete a story (soft delete)
 * DELETE /api/web/stories/:storyId
 */
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { deleteMedia = false } = req.query;

    const story = await Story.findById(storyId).select("+isDeleted");

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    // Optionally delete media from Cloudinary
    if (deleteMedia === "true" && story.cloudinaryPublicId) {
      try {
        const resourceType = story.mediaType === "video" ? "video" : "image";
        await cloudinary.uploader.destroy(story.cloudinaryPublicId, {
          resource_type: resourceType,
        });
        console.log(`[STORY] Deleted media ${story.cloudinaryPublicId} from Cloudinary`);
      } catch (cloudinaryError) {
        console.error("[STORY] Cloudinary delete error:", cloudinaryError.message);
        // Continue with soft delete even if Cloudinary delete fails
      }
    }

    // Soft delete
    await story.softDelete();

    console.log(`[STORY] Soft deleted story ${storyId}`);

    return responseUtil.success(res, "Story deleted successfully");
  } catch (error) {
    console.error("[STORY] Delete error:", error.message);
    return responseUtil.internalError(res, "Failed to delete story", error.message);
  }
};

/**
 * Hard delete a story (permanent)
 * DELETE /api/web/stories/:storyId/permanent
 */
export const hardDeleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { deleteMedia = true } = req.query;

    const story = await Story.findById(storyId).select("+isDeleted");

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    // Delete media from Cloudinary by default
    if (deleteMedia !== "false" && story.cloudinaryPublicId) {
      try {
        const resourceType = story.mediaType === "video" ? "video" : "image";
        await cloudinary.uploader.destroy(story.cloudinaryPublicId, {
          resource_type: resourceType,
        });
        console.log(`[STORY] Deleted media ${story.cloudinaryPublicId} from Cloudinary`);
      } catch (cloudinaryError) {
        console.error("[STORY] Cloudinary delete error:", cloudinaryError.message);
      }
    }

    // Hard delete
    await Story.findByIdAndDelete(storyId);

    console.log(`[STORY] Hard deleted story ${storyId}`);

    return responseUtil.success(res, "Story permanently deleted");
  } catch (error) {
    console.error("[STORY] Hard delete error:", error.message);
    return responseUtil.internalError(res, "Failed to delete story", error.message);
  }
};

/**
 * Toggle story active status
 * PATCH /api/web/stories/:storyId/toggle
 */
export const toggleStoryStatus = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    story.isActive = !story.isActive;
    await story.save();

    console.log(`[STORY] Toggled story ${storyId} to ${story.isActive ? "active" : "inactive"}`);

    return responseUtil.success(res, `Story ${story.isActive ? "activated" : "deactivated"} successfully`, {
      storyId: story._id,
      isActive: story.isActive,
    });
  } catch (error) {
    console.error("[STORY] Toggle error:", error.message);
    return responseUtil.internalError(res, "Failed to toggle story status", error.message);
  }
};

/**
 * Reorder stories
 * PUT /api/web/stories/reorder
 */
export const reorderStories = async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return responseUtil.badRequest(res, "Order must be an array of { storyId, displayOrder }");
    }

    const bulkOps = order.map((item) => ({
      updateOne: {
        filter: { _id: item.storyId },
        update: { displayOrder: item.displayOrder },
      },
    }));

    await Story.bulkWrite(bulkOps);

    console.log(`[STORY] Reordered ${order.length} stories`);

    return responseUtil.success(res, "Stories reordered successfully");
  } catch (error) {
    console.error("[STORY] Reorder error:", error.message);
    return responseUtil.internalError(res, "Failed to reorder stories", error.message);
  }
};

/**
 * Get story statistics
 * GET /api/web/stories/stats
 */
export const getStoryStats = async (req, res) => {
  try {
    const now = new Date();

    const [totalStories, activeStories, expiredStories, viewStats] =
      await Promise.all([
        Story.countDocuments({ isDeleted: false }),
        Story.countDocuments({
          isDeleted: false,
          isActive: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        }),
        Story.countDocuments({
          isDeleted: false,
          expiresAt: { $lte: now, $ne: null },
        }),
        Story.aggregate([
          { $match: { isDeleted: false } },
          {
            $group: {
              _id: null,
              totalViews: { $sum: "$viewCount" },
              avgViews: { $avg: "$viewCount" },
            },
          },
        ]),
      ]);

    return responseUtil.success(res, "Story statistics fetched successfully", {
      totalStories,
      activeStories,
      expiredStories,
      inactiveStories: totalStories - activeStories - expiredStories,
      totalViews: viewStats[0]?.totalViews || 0,
      averageViews: Math.round(viewStats[0]?.avgViews || 0),
    });
  } catch (error) {
    console.error("[STORY] Stats error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch story statistics", error.message);
  }
};

/**
 * Get TTL options
 * GET /api/web/stories/ttl-options
 */
export const getTTLOptions = (req, res) => {
  const options = TTL_OPTIONS.map((key) => ({
    value: key,
    label: key.replace(/_/g, " "),
  }));

  return responseUtil.success(res, "TTL options fetched successfully", { options });
};

export default {
  createStory,
  getAllStories,
  getStoryById,
  updateStory,
  deleteStory,
  hardDeleteStory,
  toggleStoryStatus,
  reorderStories,
  getStoryStats,
  getTTLOptions,
};
