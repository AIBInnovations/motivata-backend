/**
 * @fileoverview User routes for Challenge participation
 * @module routes/user/challenge
 */

import express from "express";
import {
  getAvailableChallenges,
  joinChallenge,
  getMyChallenges,
  getChallengeProgress,
  markTaskComplete,
  unmarkTask,
  abandonChallenge,
} from "./challenge.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { challengeSchemas } from "./challenge.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * @route   GET /api/app/challenges
 * @desc    Get available challenges (with user status if authenticated)
 * @access  Public (optional auth)
 */
router.get("/", optionalAuth, validateQuery(challengeSchemas.list), getAvailableChallenges);

// ============================================
// AUTHENTICATED ROUTES
// ============================================
router.use(authenticate);

/**
 * @route   POST /api/app/challenges/join
 * @desc    Join a challenge (max 5 active)
 * @access  User (authenticated)
 */
router.post("/join", validateBody(challengeSchemas.join), joinChallenge);

/**
 * @route   GET /api/app/challenges/my-challenges
 * @desc    Get user's challenges
 * @access  User (authenticated)
 */
router.get("/my-challenges", validateQuery(challengeSchemas.myChallenges), getMyChallenges);

/**
 * @route   GET /api/app/challenges/:challengeId/progress
 * @desc    Get user's progress for a specific challenge
 * @access  User (authenticated)
 */
router.get("/:challengeId/progress", validateParams(challengeSchemas.challengeId), getChallengeProgress);

/**
 * @route   POST /api/app/challenges/:challengeId/tasks/:taskId/complete
 * @desc    Mark task as complete for today
 * @access  User (authenticated)
 */
router.post("/:challengeId/tasks/:taskId/complete", validateParams(challengeSchemas.taskParams), markTaskComplete);

/**
 * @route   POST /api/app/challenges/:challengeId/tasks/:taskId/uncomplete
 * @desc    Unmark task (toggle off)
 * @access  User (authenticated)
 */
router.post("/:challengeId/tasks/:taskId/uncomplete", validateParams(challengeSchemas.taskParams), unmarkTask);

/**
 * @route   POST /api/app/challenges/:challengeId/abandon
 * @desc    Abandon a challenge
 * @access  User (authenticated)
 */
router.post("/:challengeId/abandon", validateParams(challengeSchemas.challengeId), abandonChallenge);

export default router;
