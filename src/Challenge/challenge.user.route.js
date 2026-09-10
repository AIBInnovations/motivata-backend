/**
 * @fileoverview User routes for Challenge participation
 * @module routes/user/challenge
 */

import express from "express";
import {
  getAvailableChallenges,
  getChallengeCategories,
  getChallengeShareLink,
  joinChallenge,
  getMyChallenges,
  getChallengeProgress,
  nudgeConnections,
  markTaskComplete,
  unmarkTask,
  markDayComplete,
  unmarkDayComplete,
  abandonChallenge,
} from "./challenge.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { challengeSchemas } from "./challenge.validation.js";
import {
  getTodayDailyChallenge,
  completeDailyChallenge,
  uncompleteDailyChallenge,
} from "./dailyChallenge.controller.js";
import {
  getChallengeRewardsForUser,
  claimReward,
} from "./challengeReward.controller.js";
import { challengeRewardSchemas } from "./challengeReward.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * @route   GET /api/app/challenges
 * @desc    Get available challenges (with user status if authenticated)
 * @access  Public (optional auth)
 */
router.get("/", optionalAuth, validateQuery(challengeSchemas.list), getAvailableChallenges);

/**
 * @route   GET /api/app/challenges/categories
 * @desc    Category → sub-category → difficulty catalog with live counts
 * @access  Public
 */
router.get("/categories", getChallengeCategories);

/**
 * @route   GET /api/app/challenges/daily/today
 * @desc    Today's scheduled daily challenge plus completion counts
 * @access  Public (optional auth)
 */
router.get("/daily/today", optionalAuth, getTodayDailyChallenge);

/**
 * @route   GET /api/app/challenges/:challengeId/share
 * @desc    Get a shareable deep-link + pre-filled WhatsApp message for a challenge
 * @access  Public
 */
router.get("/:challengeId/share", optionalAuth, validateParams(challengeSchemas.challengeId), getChallengeShareLink);

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
 * @route   POST /api/app/challenges/daily/complete
 * @desc    Mark today's daily challenge complete
 * @access  User (authenticated)
 */
router.post("/daily/complete", completeDailyChallenge);

/**
 * @route   POST /api/app/challenges/daily/uncomplete
 * @desc    Undo today's daily challenge completion
 * @access  User (authenticated)
 */
router.post("/daily/uncomplete", uncompleteDailyChallenge);

/**
 * @route   GET /api/app/challenges/:challengeId/rewards
 * @desc    Rewards attached to a challenge, with unlock state and my claim
 * @access  User (authenticated)
 */
router.get(
  "/:challengeId/rewards",
  validateParams(challengeRewardSchemas.challengeId),
  getChallengeRewardsForUser
);

/**
 * @route   POST /api/app/challenges/rewards/:rewardId/claim
 * @desc    Claim an unlocked reward and get its redemption code
 * @access  User (authenticated)
 */
router.post(
  "/rewards/:rewardId/claim",
  validateParams(challengeRewardSchemas.rewardId),
  claimReward
);

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
 * @route   POST /api/app/challenges/:challengeId/nudge
 * @desc    Notify the user's connections taking this challenge to update their progress
 * @access  User (authenticated)
 */
router.post("/:challengeId/nudge", validateParams(challengeSchemas.challengeId), nudgeConnections);

/**
 * @route   POST /api/app/challenges/:challengeId/complete-day
 * @desc    Mark the whole of today done — works with or without tasks
 * @access  User (authenticated)
 */
router.post("/:challengeId/complete-day", validateParams(challengeSchemas.challengeId), markDayComplete);

/**
 * @route   POST /api/app/challenges/:challengeId/uncomplete-day
 * @desc    Undo today's completion
 * @access  User (authenticated)
 */
router.post("/:challengeId/uncomplete-day", validateParams(challengeSchemas.challengeId), unmarkDayComplete);

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
