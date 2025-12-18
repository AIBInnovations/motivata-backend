/**
 * @fileoverview User Story Controller
 * @module Story/user.controller
 *
 * Handles user-facing operations for stories.
 * Users can only view stories - they cannot create, update, or delete.
 */

import Story from "../../schema/Story.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Get all active stories for display
 * GET /api/app/stories
 */
export const getActiveStories = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const stories = await Story.getActiveStories({
      page: parseInt(page),
      limit: parseInt(limit),
    });

    const total = await Story.countActiveStories();

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
    console.error("[STORY] Get active stories error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch stories", error.message);
  }
};

/**
 * Get a single story by ID and optionally increment view count
 * GET /api/app/stories/:storyId
 */
export const getStoryById = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { incrementView = true } = req.query;

    const now = new Date();

    // Find story that is active and not expired
    const story = await Story.findOne({
      _id: storyId,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).select("-isDeleted -deletedAt");

    if (!story) {
      return responseUtil.notFound(res, "Story not found or has expired");
    }

    // Increment view count if requested
    if (incrementView !== "false") {
      await Story.incrementViewCount(storyId);
    }

    return responseUtil.success(res, "Story fetched successfully", story);
  } catch (error) {
    console.error("[STORY] Get story error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch story", error.message);
  }
};

/**
 * Mark story as viewed (increment view count)
 * POST /api/app/stories/:storyId/view
 */
export const markStoryViewed = async (req, res) => {
  try {
    const { storyId } = req.params;

    const now = new Date();

    // Check if story exists and is viewable
    const story = await Story.findOne({
      _id: storyId,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    if (!story) {
      return responseUtil.notFound(res, "Story not found or has expired");
    }

    // Increment view count
    await Story.incrementViewCount(storyId);

    return responseUtil.success(res, "Story view recorded");
  } catch (error) {
    console.error("[STORY] Mark viewed error:", error.message);
    return responseUtil.internalError(res, "Failed to record story view", error.message);
  }
};

/**
 * Get story count (for badge/notification purposes)
 * GET /api/app/stories/count
 */
export const getStoryCount = async (req, res) => {
  try {
    const count = await Story.countActiveStories();

    return responseUtil.success(res, "Story count fetched successfully", { count });
  } catch (error) {
    console.error("[STORY] Get count error:", error.message);
    return responseUtil.internalError(res, "Failed to fetch story count", error.message);
  }
};

export default {
  getActiveStories,
  getStoryById,
  markStoryViewed,
  getStoryCount,
};
