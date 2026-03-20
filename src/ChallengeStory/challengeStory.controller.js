/**
 * @fileoverview ChallengeStory controller for user-generated challenge stories
 * @module controllers/challengeStory
 */

import mongoose from "mongoose";
import ChallengeStory from "../../schema/ChallengeStory.schema.js";
import ChallengeStoryView from "../../schema/ChallengeStoryView.schema.js";
import UserChallenge from "../Challenge/userChallenge.schema.js";
import responseUtil from "../../utils/response.util.js";

// ============================================
// USER CONTROLLERS
// ============================================

/**
 * Create a challenge story
 * Validates that the user has an active UserChallenge for the given challenge.
 *
 * @route POST /api/app/challenge-stories/:challengeId
 * @access Authenticated
 */
export const createStory = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;
    const { mediaType, mediaUrl, cloudinaryPublicId, caption, backgroundColor } =
      req.body;

    // Validate user has an active challenge
    const userChallenge = await UserChallenge.findOne({
      userId,
      challengeId,
      status: { $in: ["active", "completed"] },
    });

    if (!userChallenge) {
      return responseUtil.forbidden(
        res,
        "You must have an active participation in this challenge to post a story"
      );
    }

    const story = new ChallengeStory({
      userId,
      challengeId,
      mediaType,
      mediaUrl: mediaUrl || null,
      cloudinaryPublicId: cloudinaryPublicId || null,
      caption: caption || null,
      backgroundColor: backgroundColor || null,
      // expiresAt is set automatically by pre-save hook (24hrs from creation)
    });

    await story.save();

    // Populate user data for response
    await story.populate("userId", "name");

    return responseUtil.created(res, "Challenge story created successfully", {
      story,
    });
  } catch (error) {
    console.error("[CHALLENGE_STORY] Create error:", error.message);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to create challenge story",
      error.message
    );
  }
};

/**
 * Get stories for a challenge, grouped by user (for story circles display).
 * Returns an array of { user, stories[], hasUnviewed, storyCount } objects.
 * If authenticated, adds viewed flags and moves current user to front.
 *
 * @route GET /api/app/challenge-stories/:challengeId
 * @access Optional Auth
 */
export const getStoriesByChallengeGrouped = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const requestingUserId = req.user?.id || null;
    const now = new Date();

    // Aggregate: get all active stories for this challenge, grouped by user
    const userStories = await ChallengeStory.aggregate([
      {
        $match: {
          challengeId: new mongoose.Types.ObjectId(challengeId),
          isDeleted: false,
          expiresAt: { $gt: now },
        },
      },
      { $sort: { createdAt: 1 } }, // oldest first within each user
      {
        $group: {
          _id: "$userId",
          stories: { $push: "$$ROOT" },
          latestStoryAt: { $max: "$createdAt" },
          storyCount: { $sum: 1 },
        },
      },
      { $sort: { latestStoryAt: -1 } }, // users with most recent story first
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
          _id: 0,
          user: {
            _id: { $toString: "$user._id" },
            name: "$user.name",
          },
          stories: {
            $map: {
              input: "$stories",
              as: "s",
              in: {
                _id: { $toString: "$$s._id" },
                userId: { $toString: "$$s.userId" },
                challengeId: { $toString: "$$s.challengeId" },
                mediaType: "$$s.mediaType",
                mediaUrl: "$$s.mediaUrl",
                caption: "$$s.caption",
                backgroundColor: "$$s.backgroundColor",
                viewCount: "$$s.viewCount",
                expiresAt: "$$s.expiresAt",
                createdAt: "$$s.createdAt",
              },
            },
          },
          latestStoryAt: 1,
          storyCount: 1,
        },
      },
    ]);

    // Add viewed status and hasUnviewed flags
    if (requestingUserId) {
      const allStoryIds = userStories.flatMap((us) =>
        us.stories.map((s) => new mongoose.Types.ObjectId(s._id))
      );

      const viewedStories = await ChallengeStoryView.find({
        storyId: { $in: allStoryIds },
        userId: new mongoose.Types.ObjectId(requestingUserId),
      }).select("storyId");

      const viewedSet = new Set(
        viewedStories.map((v) => v.storyId.toString())
      );

      userStories.forEach((us) => {
        us.stories.forEach((s) => {
          s.viewed = viewedSet.has(s._id);
        });
        us.hasUnviewed = us.stories.some((s) => !s.viewed);
      });

      // Move requesting user to front (Instagram convention: "Your Story" first)
      const myIndex = userStories.findIndex(
        (us) => us.user._id === requestingUserId
      );
      if (myIndex > 0) {
        const [myStories] = userStories.splice(myIndex, 1);
        userStories.unshift(myStories);
      }
    } else {
      // For unauthenticated users, set defaults
      userStories.forEach((us) => {
        us.stories.forEach((s) => {
          s.viewed = false;
        });
        us.hasUnviewed = true;
      });
    }

    return responseUtil.success(
      res,
      "Challenge stories fetched successfully",
      {
        userStories,
        totalUsers: userStories.length,
      }
    );
  } catch (error) {
    console.error("[CHALLENGE_STORY] Get grouped error:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch challenge stories",
      error.message
    );
  }
};

/**
 * Mark a challenge story as viewed (unique per user).
 * Increments viewCount only on first view.
 *
 * @route POST /api/app/challenge-stories/view/:storyId
 * @access Authenticated
 */
export const markStoryViewed = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Check story exists and is not expired
    const story = await ChallengeStory.findOne({
      _id: storyId,
      expiresAt: { $gt: new Date() },
    });

    if (!story) {
      return responseUtil.notFound(res, "Story not found or has expired");
    }

    // Record view (idempotent - returns false if already viewed)
    const isNewView = await ChallengeStoryView.recordView(storyId, userId);

    if (isNewView) {
      await ChallengeStory.findByIdAndUpdate(storyId, {
        $inc: { viewCount: 1 },
      });
    }

    return responseUtil.success(res, "Story view recorded");
  } catch (error) {
    console.error("[CHALLENGE_STORY] View error:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to record story view",
      error.message
    );
  }
};

/**
 * Delete own challenge story (soft delete).
 *
 * @route DELETE /api/app/challenge-stories/story/:storyId
 * @access Authenticated
 */
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const story = await ChallengeStory.findById(storyId);

    if (!story) {
      return responseUtil.notFound(res, "Story not found");
    }

    if (story.userId.toString() !== userId) {
      return responseUtil.forbidden(
        res,
        "You can only delete your own stories"
      );
    }

    await story.softDelete();

    return responseUtil.success(res, "Story deleted successfully");
  } catch (error) {
    console.error("[CHALLENGE_STORY] Delete error:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to delete story",
      error.message
    );
  }
};
