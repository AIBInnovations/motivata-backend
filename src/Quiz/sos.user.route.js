/**
 * @fileoverview User routes for SOS programs and quizzes participation
 * @module routes/user/sos
 */

import express from "express";
import Joi from "joi";
import {
  getAvailablePrograms,
  startProgram,
  getUserProgress,
  getProgramProgress,
  getTodayQuiz,
  getDayQuiz,
  submitDayQuiz,
  getLeaderboard,
} from "./sos.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { progressSchemas } from "./quiz.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * MongoDB ObjectId validation pattern
 */
const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

/**
 * Program ID param validation
 */
const programIdParam = Joi.object({
  programId: Joi.string().regex(mongoIdPattern).required().messages({
    "string.pattern.base": "Invalid program ID format",
  }),
});

/**
 * Day submission params validation
 */
const daySubmitParamsSchema = Joi.object({
  programId: Joi.string().regex(mongoIdPattern).required().messages({
    "string.pattern.base": "Invalid program ID format",
  }),
  dayNumber: Joi.number().integer().min(1).required().messages({
    "number.min": "Day number must be at least 1",
  }),
});

/**
 * Available programs query validation
 */
const availableProgramsQuery = Joi.object({
  type: Joi.string().valid("GSOS", "ISOS").optional(),
});

/**
 * Leaderboard query validation
 */
const leaderboardQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// ============================================
// PUBLIC/OPTIONAL AUTH ROUTES
// ============================================

/**
 * @route   GET /api/app/sos/programs
 * @desc    Get available SOS programs (with user progress if authenticated)
 * @access  Public (optional auth for progress)
 * @query   {string} [type] - Filter by program type (GSOS/ISOS)
 */
router.get("/programs", optionalAuth, validateQuery(availableProgramsQuery), getAvailablePrograms);

/**
 * @route   GET /api/app/sos/programs/:programId/leaderboard
 * @desc    Get program leaderboard
 * @access  Public
 * @param   {string} programId - Program ID
 * @query   {number} [limit=10] - Number of entries
 */
router.get(
  "/programs/:programId/leaderboard",
  validateParams(programIdParam),
  validateQuery(leaderboardQuery),
  getLeaderboard
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * Apply authentication to all routes below
 */
router.use(authenticate);

/**
 * @route   POST /api/app/sos/programs/start
 * @desc    Start a program (create user progress)
 * @access  User (authenticated)
 * @body    {string} programId - Program ID to start
 */
router.post("/programs/start", validateBody(progressSchemas.startProgram), startProgram);

/**
 * @route   GET /api/app/sos/my-progress
 * @desc    Get user's progress for all programs
 * @access  User (authenticated)
 * @query   {string} [status] - Filter by status
 */
router.get("/my-progress", validateQuery(progressSchemas.listProgress), getUserProgress);

/**
 * @route   GET /api/app/sos/programs/:programId/progress
 * @desc    Get user's progress for a specific program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/progress", validateParams(programIdParam), getProgramProgress);

/**
 * @route   GET /api/app/sos/programs/:programId/today-quiz
 * @desc    Get today's quiz for a program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/today-quiz", validateParams(programIdParam), getTodayQuiz);

/**
 * @route   GET /api/app/sos/programs/:programId/days/:dayNumber/quiz
 * @desc    Get quiz questions for any day in a program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 * @param   {number} dayNumber - Day number
 */
router.get("/programs/:programId/days/:dayNumber/quiz", validateParams(daySubmitParamsSchema), getDayQuiz);

/**
 * @route   POST /api/app/sos/programs/:programId/days/:dayNumber/submit
 * @desc    Submit quiz responses for a day
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 * @param   {number} dayNumber - Day number
 * @body    {Array} responses - Array of question responses
 */
router.post(
  "/programs/:programId/days/:dayNumber/submit",
  validateParams(daySubmitParamsSchema),
  validateBody(progressSchemas.submitQuiz),
  submitDayQuiz
);

export default router;
