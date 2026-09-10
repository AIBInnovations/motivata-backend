/**
 * @fileoverview Admin routes for Challenge management
 * @module routes/admin/challenge
 */

import express from "express";
import {
  createChallenge,
  getAllChallenges,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
  toggleChallengeStatus,
  getChallengeCategories,
  getIconOptions,
  getAllUserProgress,
} from "./challenge.controller.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { challengeSchemas } from "./challenge.validation.js";
import {
  createDailyChallenge,
  bulkScheduleDailyChallenges,
  getDailyChallenges,
  updateDailyChallenge,
  deleteDailyChallenge,
} from "./dailyChallenge.controller.js";
import { dailyChallengeSchemas } from "./dailyChallenge.validation.js";
import {
  createChallengeReward,
  getChallengeRewards,
  updateChallengeReward,
  deleteChallengeReward,
  verifyRewardCode,
  redeemRewardCode,
} from "./challengeReward.controller.js";
import { challengeRewardSchemas } from "./challengeReward.validation.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/challenges/categories
 * @desc    Get challenge categories with counts
 * @access  Admin
 */
router.get("/categories", getChallengeCategories);

/**
 * @route   GET /api/web/challenges/icons
 * @desc    Get preset icon catalog (key, label, url) for the admin picker
 * @access  Admin
 */
router.get("/icons", getIconOptions);

/**
 * @route   GET /api/web/challenges/daily
 * @desc    List scheduled daily challenges in a date range
 * @access  Admin
 */
router.get("/daily", validateQuery(dailyChallengeSchemas.list), getDailyChallenges);

/**
 * @route   GET /api/web/challenges/rewards
 * @desc    List rewards, optionally for one challenge
 * @access  Admin
 */
router.get("/rewards", validateQuery(challengeRewardSchemas.list), getChallengeRewards);

/**
 * @route   POST /api/web/challenges/rewards
 * @desc    Create a reward and attach it to a challenge
 * @access  Admin
 */
router.post("/rewards", validateBody(challengeRewardSchemas.create), createChallengeReward);

/**
 * @route   GET /api/web/challenges/rewards/verify
 * @desc    Look up a scanned redemption code without consuming it
 * @access  Admin
 */
router.get("/rewards/verify", validateQuery(challengeRewardSchemas.code), verifyRewardCode);

/**
 * @route   POST /api/web/challenges/rewards/redeem
 * @desc    Consume a redemption code (one time only)
 * @access  Admin
 */
router.post("/rewards/redeem", validateBody(challengeRewardSchemas.code), redeemRewardCode);

/**
 * @route   PUT /api/web/challenges/rewards/:rewardId
 * @desc    Update a reward
 * @access  Admin
 */
router.put(
  "/rewards/:rewardId",
  validateParams(challengeRewardSchemas.rewardId),
  validateBody(challengeRewardSchemas.update),
  updateChallengeReward
);

/**
 * @route   DELETE /api/web/challenges/rewards/:rewardId
 * @desc    Remove a reward
 * @access  Admin
 */
router.delete(
  "/rewards/:rewardId",
  validateParams(challengeRewardSchemas.rewardId),
  deleteChallengeReward
);

/**
 * @route   POST /api/web/challenges/daily
 * @desc    Schedule a daily challenge for one date
 * @access  Admin
 */
router.post("/daily", validateBody(dailyChallengeSchemas.create), createDailyChallenge);

/**
 * @route   POST /api/web/challenges/daily/bulk
 * @desc    Schedule many dates at once
 * @access  Admin
 */
router.post("/daily/bulk", validateBody(dailyChallengeSchemas.bulk), bulkScheduleDailyChallenges);

/**
 * @route   PUT /api/web/challenges/daily/:dailyChallengeId
 * @desc    Update one scheduled daily challenge
 * @access  Admin
 */
router.put(
  "/daily/:dailyChallengeId",
  validateParams(dailyChallengeSchemas.dailyChallengeId),
  validateBody(dailyChallengeSchemas.update),
  updateDailyChallenge
);

/**
 * @route   DELETE /api/web/challenges/daily/:dailyChallengeId
 * @desc    Remove one scheduled daily challenge
 * @access  Admin
 */
router.delete(
  "/daily/:dailyChallengeId",
  validateParams(dailyChallengeSchemas.dailyChallengeId),
  deleteDailyChallenge
);

/**
 * @route   POST /api/web/challenges
 * @desc    Create a new challenge
 * @access  Admin
 */
router.post("/", validateBody(challengeSchemas.create), createChallenge);

/**
 * @route   GET /api/web/challenges
 * @desc    Get all challenges with pagination
 * @access  Admin
 */
router.get("/", validateQuery(challengeSchemas.list), getAllChallenges);

/**
 * @route   GET /api/web/challenges/progress
 * @desc    Get all user progress (admin view)
 * @access  Admin
 */
router.get("/progress", validateQuery(challengeSchemas.adminProgress), getAllUserProgress);

/**
 * @route   GET /api/web/challenges/:challengeId
 * @desc    Get challenge by ID
 * @access  Admin
 */
router.get("/:challengeId", validateParams(challengeSchemas.challengeId), getChallengeById);

/**
 * @route   PUT /api/web/challenges/:challengeId
 * @desc    Update challenge
 * @access  Admin
 */
router.put(
  "/:challengeId",
  validateParams(challengeSchemas.challengeId),
  validateBody(challengeSchemas.update),
  updateChallenge
);

/**
 * @route   DELETE /api/web/challenges/:challengeId
 * @desc    Soft delete challenge
 * @access  Admin
 */
router.delete("/:challengeId", validateParams(challengeSchemas.challengeId), deleteChallenge);

/**
 * @route   PATCH /api/web/challenges/:challengeId/toggle-status
 * @desc    Toggle challenge active status
 * @access  Admin
 */
router.patch("/:challengeId/toggle-status", validateParams(challengeSchemas.challengeId), toggleChallengeStatus);

export default router;
