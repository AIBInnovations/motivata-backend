/**
 * @fileoverview User quiz routes for taking quizzes and viewing submissions
 * @module routes/user/quiz
 */

import express from "express";
import {
  getAllQuizzes,
  getQuizForUser,
  submitQuiz,
  getUserSubmissions,
  enrollUser,
} from "./quiz.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../../middleware/validation.middleware.js";
import { quizSchemas } from "./quiz.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * @route   GET /api/app/quizzes
 * @desc    Get all live quizzes with filters and pagination
 * @access  Public
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page (max 100)
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order (asc/desc)
 * @query   {boolean} [isPaid] - Filter by paid status
 * @query   {string} [enrollmentType] - Filter by enrollment type
 * @query   {string} [search] - Search in title and description
 * @returns {Object} Paginated list of live quizzes
 */
router.get(
  "/",
  optionalAuth,
  validateQuery(quizSchemas.list),
  (req, _res, next) => {
    // Force isLive to be true for public access
    req.query.isLive = true;
    next();
  },
  getAllQuizzes
);

/**
 * @route   GET /api/app/quizzes/:id
 * @desc    Get single quiz for taking (answers hidden)
 * @access  Public (auth required for REGISTERED quizzes)
 * @param   {string} id - Quiz ID
 * @returns {Object} Quiz details (without correct answers)
 */
router.get(
  "/:id",
  optionalAuth,
  validateParams(quizSchemas.quizId),
  getQuizForUser
);

/**
 * @route   POST /api/app/quizzes/:id/enroll
 * @desc    Enroll in a quiz
 * @access  User (authenticated)
 * @param   {string} id - Quiz ID
 * @returns {Object} Enrollment confirmation
 */
router.post(
  "/:id/enroll",
  authenticate,
  validateParams(quizSchemas.quizId),
  enrollUser
);

/**
 * @route   POST /api/app/quizzes/:id/submit
 * @desc    Submit quiz answers
 * @access  User (authenticated)
 * @param   {string} id - Quiz ID
 * @body    {Array} answers - Array of answers
 * @body    {number} [timeTaken] - Time taken in seconds
 * @returns {Object} Submission result with score
 */
router.post(
  "/:id/submit",
  authenticate,
  validateParams(quizSchemas.quizId),
  validateBody(quizSchemas.submitQuiz),
  submitQuiz
);

/**
 * @route   GET /api/app/quizzes/:id/submissions
 * @desc    Get user's own submissions for a quiz
 * @access  User (authenticated)
 * @param   {string} id - Quiz ID
 * @returns {Object} User's submissions for the quiz
 */
router.get(
  "/:id/submissions",
  authenticate,
  validateParams(quizSchemas.quizId),
  getUserSubmissions
);

export default router;
