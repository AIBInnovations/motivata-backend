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
  downloadCertificate,
  resetProgram,
  retryProgram,
  getScheduleInfo,
  confirmSchedule,
  getDayArticle,
  getTodayDailyQuestion,
  submitDailyAnswer,
  getDailyAnswerHistory,
  getQoLFactors,
  submitQoLEntry,
  getLatestQoLEntry,
  getQoLHistory,
} from "./sos.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import { requireProgramAccess } from "../FeatureAccess/programAccess.middleware.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { progressSchemas, dailySosSchemas, qolSchemas } from "./quiz.validation.js";

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
router.post("/programs/start", validateBody(progressSchemas.startProgram), requireProgramAccess, startProgram);

/**
 * @route   POST /api/app/sos/programs/reset
 * @desc    Reset user's progress for a program back to not_started
 * @access  User (authenticated)
 * @body    {string} programId - Program ID to reset
 */
router.post("/programs/reset", validateBody(progressSchemas.resetProgram), resetProgram);

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
router.get("/programs/:programId/today-quiz", validateParams(programIdParam), requireProgramAccess, getTodayQuiz);

/**
 * @route   GET /api/app/sos/programs/:programId/days/:dayNumber/quiz
 * @desc    Get quiz questions for any day in a program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 * @param   {number} dayNumber - Day number
 */
router.get(
  "/programs/:programId/days/:dayNumber/quiz",
  validateParams(daySubmitParamsSchema),
  requireProgramAccess,
  getDayQuiz
);

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
  requireProgramAccess,
  submitDayQuiz
);

/**
 * @route   GET /api/app/sos/programs/:programId/certificate
 * @desc    Download certificate for a completed SOS program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/certificate", validateParams(programIdParam), downloadCertificate);

/**
 * @route   POST /api/app/sos/programs/:programId/retry
 * @desc    Retry (restart) a completed or abandoned SOS program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 */
router.post("/programs/:programId/retry", validateParams(programIdParam), requireProgramAccess, retryProgram);

/**
 * @route   GET /api/app/sos/programs/:programId/schedule-info
 * @desc    Get Calendly scheduling URL for a paid SOS program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/schedule-info", validateParams(programIdParam), requireProgramAccess, getScheduleInfo);

/**
 * @route   POST /api/app/sos/programs/:programId/confirm-schedule
 * @desc    Confirm session scheduled via Calendly (app calls after booking)
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 * @body    {string} [scheduledAt] - ISO date string of scheduled time
 * @body    {string} [calendlyInviteeUri] - Calendly invitee URI
 */
router.post(
  "/programs/:programId/confirm-schedule",
  validateParams(programIdParam),
  requireProgramAccess,
  confirmSchedule
);

/**
 * @route   GET /api/app/sos/programs/:programId/days/:dayNumber/article
 * @desc    Get the article for a specific day of a program
 * @access  User (authenticated)
 * @param   {string} programId - Program ID
 * @param   {number} dayNumber - Day number
 */
router.get(
  "/programs/:programId/days/:dayNumber/article",
  validateParams(daySubmitParamsSchema),
  requireProgramAccess,
  getDayArticle
);

/**
 * @route   GET /api/app/sos/daily-question
 * @desc    Get today's daily SOS question (IST) and whether the user answered it
 * @access  User (authenticated)
 */
router.get("/daily-question", getTodayDailyQuestion);

/**
 * @route   POST /api/app/sos/daily-question/answer
 * @desc    Submit the answer for today's daily SOS question
 * @access  User (authenticated)
 */
router.post("/daily-question/answer", validateBody(dailySosSchemas.submitAnswer), submitDailyAnswer);

/**
 * @route   GET /api/app/sos/daily-question/history
 * @desc    Get the user's past daily SOS answers
 * @access  User (authenticated)
 */
router.get("/daily-question/history", validateQuery(dailySosSchemas.history), getDailyAnswerHistory);

/**
 * @route   GET /api/app/sos/quality-of-life/factors
 * @desc    Get the active quality of life factors to rate
 * @access  User (authenticated)
 */
router.get("/quality-of-life/factors", getQoLFactors);

/**
 * @route   POST /api/app/sos/quality-of-life
 * @desc    Submit current + required scores for every factor
 * @access  User (authenticated)
 */
router.post("/quality-of-life", validateBody(qolSchemas.submitEntry), submitQoLEntry);

/**
 * @route   GET /api/app/sos/quality-of-life/latest
 * @desc    Get the user's most recent quality of life entry
 * @access  User (authenticated)
 */
router.get("/quality-of-life/latest", getLatestQoLEntry);

/**
 * @route   GET /api/app/sos/quality-of-life/history
 * @desc    Get the user's past quality of life entries
 * @access  User (authenticated)
 */
router.get("/quality-of-life/history", validateQuery(qolSchemas.history), getQoLHistory);

export default router;
