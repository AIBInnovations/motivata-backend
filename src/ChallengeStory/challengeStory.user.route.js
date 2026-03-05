/**
 * @fileoverview User routes for Challenge Stories
 * @module routes/user/challengeStory
 *
 * Base path: /api/app/challenge-stories
 *
 * Route ordering is critical to avoid path conflicts:
 * 1. GET /:challengeId (optionalAuth) - defined first
 * 2. router.use(authenticate) - all subsequent routes require auth
 * 3. POST /view/:storyId - specific named path before parameterized
 * 4. DELETE /story/:storyId - specific named path before parameterized
 * 5. POST /:challengeId - parameterized path last
 */

import express from "express";
import {
  createStory,
  getStoriesByChallengeGrouped,
  markStoryViewed,
  deleteStory,
} from "./challengeStory.controller.js";
import {
  authenticate,
  optionalAuth,
} from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
} from "../../middleware/validation.middleware.js";
import { challengeStorySchemas } from "./challengeStory.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * @route   GET /api/app/challenge-stories/:challengeId
 * @desc    Get stories for a challenge, grouped by user
 * @access  Public (optional auth for view tracking)
 */
router.get(
  "/:challengeId",
  optionalAuth,
  validateParams(challengeStorySchemas.challengeIdParam),
  getStoriesByChallengeGrouped
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
router.use(authenticate);

/**
 * @route   POST /api/app/challenge-stories/view/:storyId
 * @desc    Mark a story as viewed
 * @access  User (authenticated)
 */
router.post(
  "/view/:storyId",
  validateParams(challengeStorySchemas.storyIdParam),
  markStoryViewed
);

/**
 * @route   DELETE /api/app/challenge-stories/story/:storyId
 * @desc    Delete own story (soft delete)
 * @access  User (authenticated)
 */
router.delete(
  "/story/:storyId",
  validateParams(challengeStorySchemas.storyIdParam),
  deleteStory
);

/**
 * @route   POST /api/app/challenge-stories/:challengeId
 * @desc    Create a story for a challenge
 * @access  User (authenticated)
 */
router.post(
  "/:challengeId",
  validateParams(challengeStorySchemas.challengeIdParam),
  validateBody(challengeStorySchemas.create),
  createStory
);

export default router;
