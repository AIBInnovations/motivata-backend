/**
 * @fileoverview User Story Routes
 * @module Story/user.route
 *
 * Routes for user viewing of stories.
 * These routes are publicly accessible (no auth required for viewing stories).
 */

import express from "express";
import storyController from "./story.user.controller.js";
import {
  validateParams,
  validateQuery,
  storySchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * GET /api/app/stories
 * Get all active stories for display
 */
router.get(
  "/",
  validateQuery(storySchemas.listUser),
  storyController.getActiveStories
);

/**
 * GET /api/app/stories/count
 * Get count of active stories (for badge/notification)
 */
router.get("/count", storyController.getStoryCount);

/**
 * GET /api/app/stories/:storyId
 * Get a single story by ID
 */
router.get(
  "/:storyId",
  validateParams(storySchemas.storyId),
  storyController.getStoryById
);

/**
 * POST /api/app/stories/:storyId/view
 * Mark a story as viewed (increment view count)
 */
router.post(
  "/:storyId/view",
  validateParams(storySchemas.storyId),
  storyController.markStoryViewed
);

export default router;
