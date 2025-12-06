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
  getAllUserProgress,
} from "./challenge.controller.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { challengeSchemas } from "./challenge.validation.js";
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
