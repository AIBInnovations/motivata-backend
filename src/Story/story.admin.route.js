/**
 * @fileoverview Admin Story Routes
 * @module Story/admin.route
 *
 * Routes for admin management of stories.
 * All routes require admin authentication.
 */

import express from "express";
import storyController from "./story.admin.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  storySchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * All routes require admin authentication
 */
router.use(authenticate, isAdmin);

/**
 * GET /api/web/stories/ttl-options
 * Get available TTL options
 */
router.get("/ttl-options", storyController.getTTLOptions);

/**
 * GET /api/web/stories/stats
 * Get story statistics
 */
router.get("/stats", storyController.getStoryStats);

/**
 * POST /api/web/stories
 * Create a new story
 */
router.post(
  "/",
  validateBody(storySchemas.create),
  storyController.createStory
);

/**
 * GET /api/web/stories
 * Get all stories (admin view with metadata)
 */
router.get(
  "/",
  validateQuery(storySchemas.listAdmin),
  storyController.getAllStories
);

/**
 * PUT /api/web/stories/reorder
 * Reorder stories
 */
router.put(
  "/reorder",
  validateBody(storySchemas.reorder),
  storyController.reorderStories
);

/**
 * GET /api/web/stories/:storyId
 * Get a single story by ID
 */
router.get(
  "/:storyId",
  validateParams(storySchemas.storyId),
  storyController.getStoryById
);

/**
 * PUT /api/web/stories/:storyId
 * Update a story
 */
router.put(
  "/:storyId",
  validateParams(storySchemas.storyId),
  validateBody(storySchemas.update),
  storyController.updateStory
);

/**
 * PATCH /api/web/stories/:storyId/toggle
 * Toggle story active status
 */
router.patch(
  "/:storyId/toggle",
  validateParams(storySchemas.storyId),
  storyController.toggleStoryStatus
);

/**
 * DELETE /api/web/stories/:storyId
 * Soft delete a story
 */
router.delete(
  "/:storyId",
  validateParams(storySchemas.storyId),
  storyController.deleteStory
);

/**
 * DELETE /api/web/stories/:storyId/permanent
 * Permanently delete a story
 */
router.delete(
  "/:storyId/permanent",
  validateParams(storySchemas.storyId),
  storyController.hardDeleteStory
);

export default router;
