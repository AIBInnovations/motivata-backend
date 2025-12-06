/**
 * @fileoverview Admin routes for SOS programs and quizzes management
 * @module routes/admin/sos
 */

import express from "express";
import {
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  toggleProgramStatus,
  createQuiz,
  getAllQuizzes,
  getQuizzesByProgram,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getAllUserProgress,
  getProgramStats,
} from "./sos.controller.js";
import { validateParams, validateQuery, validateBody } from "../../middleware/validation.middleware.js";
import { programSchemas, sosQuizSchemas, progressSchemas } from "./quiz.validation.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

// ============================================
// SOS PROGRAM ROUTES
// ============================================

/**
 * @route   POST /api/web/sos/programs
 * @desc    Create a new SOS program
 * @access  Admin
 * @body    {Object} - Program data (title, type, description, durationDays, isActive, imageUrl)
 */
router.post("/programs", validateBody(programSchemas.create), createProgram);

/**
 * @route   GET /api/web/sos/programs
 * @desc    Get all SOS programs with pagination
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order
 * @query   {string} [type] - Filter by program type (GSOS/ISOS)
 * @query   {boolean} [isActive] - Filter by active status
 * @query   {string} [search] - Search in title/description
 */
router.get("/programs", validateQuery(programSchemas.list), getAllPrograms);

/**
 * @route   GET /api/web/sos/programs/:programId
 * @desc    Get single SOS program by ID
 * @access  Admin
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId", validateParams(programSchemas.programId), getProgramById);

/**
 * @route   PUT /api/web/sos/programs/:programId
 * @desc    Update SOS program
 * @access  Admin
 * @param   {string} programId - Program ID
 * @body    {Object} - Updated program data
 */
router.put(
  "/programs/:programId",
  validateParams(programSchemas.programId),
  validateBody(programSchemas.update),
  updateProgram
);

/**
 * @route   DELETE /api/web/sos/programs/:programId
 * @desc    Soft delete SOS program
 * @access  Admin
 * @param   {string} programId - Program ID
 */
router.delete("/programs/:programId", validateParams(programSchemas.programId), deleteProgram);

/**
 * @route   PATCH /api/web/sos/programs/:programId/toggle-status
 * @desc    Toggle program active status
 * @access  Admin
 * @param   {string} programId - Program ID
 */
router.patch("/programs/:programId/toggle-status", validateParams(programSchemas.programId), toggleProgramStatus);

/**
 * @route   GET /api/web/sos/programs/:programId/stats
 * @desc    Get program statistics
 * @access  Admin
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/stats", validateParams(programSchemas.programId), getProgramStats);

/**
 * @route   GET /api/web/sos/programs/:programId/quizzes
 * @desc    Get all quizzes for a program
 * @access  Admin
 * @param   {string} programId - Program ID
 */
router.get("/programs/:programId/quizzes", validateParams(sosQuizSchemas.programIdParam), getQuizzesByProgram);

// ============================================
// SOS QUIZ ROUTES
// ============================================

/**
 * @route   POST /api/web/sos/quizzes
 * @desc    Create a new SOS quiz
 * @access  Admin
 * @body    {Object} - Quiz data (programId, dayNumber, title, description, questions, isActive)
 */
router.post("/quizzes", validateBody(sosQuizSchemas.create), createQuiz);

/**
 * @route   GET /api/web/sos/quizzes
 * @desc    Get all SOS quizzes with pagination
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @query   {string} [sortBy=dayNumber] - Sort field
 * @query   {string} [sortOrder=asc] - Sort order
 * @query   {string} [programId] - Filter by program
 * @query   {number} [dayNumber] - Filter by day number
 * @query   {boolean} [isActive] - Filter by active status
 */
router.get("/quizzes", validateQuery(sosQuizSchemas.list), getAllQuizzes);

/**
 * @route   GET /api/web/sos/quizzes/:quizId
 * @desc    Get single SOS quiz by ID
 * @access  Admin
 * @param   {string} quizId - Quiz ID
 */
router.get("/quizzes/:quizId", validateParams(sosQuizSchemas.quizId), getQuizById);

/**
 * @route   PUT /api/web/sos/quizzes/:quizId
 * @desc    Update SOS quiz
 * @access  Admin
 * @param   {string} quizId - Quiz ID
 * @body    {Object} - Updated quiz data
 */
router.put("/quizzes/:quizId", validateParams(sosQuizSchemas.quizId), validateBody(sosQuizSchemas.update), updateQuiz);

/**
 * @route   DELETE /api/web/sos/quizzes/:quizId
 * @desc    Soft delete SOS quiz
 * @access  Admin
 * @param   {string} quizId - Quiz ID
 */
router.delete("/quizzes/:quizId", validateParams(sosQuizSchemas.quizId), deleteQuiz);

// ============================================
// USER PROGRESS ROUTES (Admin View)
// ============================================

/**
 * @route   GET /api/web/sos/progress
 * @desc    Get all user progress records
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @query   {string} [sortBy=lastActivityAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order
 * @query   {string} [status] - Filter by status
 * @query   {string} [programId] - Filter by program
 * @query   {string} [userId] - Filter by user
 */
router.get("/progress", validateQuery(progressSchemas.adminListProgress), getAllUserProgress);

export default router;
