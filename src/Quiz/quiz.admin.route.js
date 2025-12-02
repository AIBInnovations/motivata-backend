/**
 * @fileoverview Admin quiz routes with full CRUD operations, question management, and submission handling
 * @module routes/admin/quiz
 */

import express from "express";
import {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  deleteQuiz,
  restoreQuiz,
  getDeletedQuizzes,
  permanentDeleteQuiz,
  toggleQuizLiveStatus,
  getQuizStats,
  getQuizzesForDropdown,
  getAllSubmissions,
  gradeSubmission,
} from "./quiz.controller.js";
import {
  authenticate,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import { quizSchemas } from "./quiz.validation.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/quizzes
 * @desc    Create a new quiz
 * @access  Admin
 * @body    {Object} Quiz data
 * @body    {string} title - Quiz title (required)
 * @body    {string} [shortDescription] - Brief description
 * @body    {boolean} [isPaid=false] - Whether quiz is paid
 * @body    {number} [price] - Quiz price (required if isPaid)
 * @body    {number} [compareAtPrice] - Compare at price
 * @body    {string} [enrollmentType=OPEN] - Enrollment type (REGISTERED/OPEN)
 * @body    {Array} [questions] - Quiz questions
 * @body    {number} [timeLimit] - Time limit in minutes
 * @body    {boolean} [shuffleQuestions=false] - Shuffle questions
 * @body    {boolean} [showResults=true] - Show results after submission
 * @body    {number} [maxAttempts] - Maximum attempts allowed
 * @body    {string} [imageUrl] - Quiz image URL
 * @returns {Object} Created quiz
 */
router.post("/", validateBody(quizSchemas.create), createQuiz);

/**
 * @route   GET /api/web/quizzes
 * @desc    Get all quizzes with filters and pagination
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page (max 100)
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order (asc/desc)
 * @query   {boolean} [isLive] - Filter by live status
 * @query   {boolean} [isPaid] - Filter by paid status
 * @query   {string} [enrollmentType] - Filter by enrollment type
 * @query   {string} [search] - Search in title and description
 * @returns {Object} Paginated list of quizzes
 */
router.get("/", validateQuery(quizSchemas.list), getAllQuizzes);

/**
 * @route   GET /api/web/quizzes/deleted
 * @desc    Get all soft deleted quizzes
 * @access  Admin
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 * @returns {Object} Paginated list of deleted quizzes
 */
router.get("/deleted", validateQuery(quizSchemas.list), getDeletedQuizzes);

/**
 * @route   GET /api/web/quizzes/dropdown
 * @desc    Get all quizzes for dropdown (lightweight - _id, title, etc.)
 * @access  Admin
 * @query   {boolean} [isLive] - Filter by live status
 * @query   {string} [search] - Search by quiz title
 * @returns {Object} List of quizzes for dropdown
 */
router.get("/dropdown", getQuizzesForDropdown);

/**
 * @route   GET /api/web/quizzes/:id/stats
 * @desc    Get quiz statistics (submissions, scores, etc.)
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @returns {Object} Quiz statistics
 */
router.get("/:id/stats", validateParams(quizSchemas.quizId), getQuizStats);

/**
 * @route   GET /api/web/quizzes/:id/submissions
 * @desc    Get all submissions for a quiz
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=20] - Items per page
 * @query   {string} [status] - Filter by status (PENDING/GRADED/REVIEWED)
 * @returns {Object} Paginated list of submissions
 */
router.get(
  "/:id/submissions",
  validateParams(quizSchemas.quizId),
  validateQuery(quizSchemas.submissionList),
  getAllSubmissions
);

/**
 * @route   POST /api/web/quizzes/:id/submissions/:submissionId/grade
 * @desc    Grade/review a submission (for QNA questions)
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @param   {string} submissionId - Submission ID
 * @body    {Array} grades - Array of grades for questions
 * @returns {Object} Graded submission
 */
router.post(
  "/:id/submissions/:submissionId/grade",
  validateParams(quizSchemas.submissionParams),
  validateBody(quizSchemas.gradeSubmission),
  gradeSubmission
);

/**
 * @route   POST /api/web/quizzes/:id/toggle-live
 * @desc    Toggle quiz live status (activate/deactivate)
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @returns {Object} Updated quiz
 */
router.post(
  "/:id/toggle-live",
  validateParams(quizSchemas.quizId),
  toggleQuizLiveStatus
);

/**
 * @route   POST /api/web/quizzes/:id/questions
 * @desc    Add questions to quiz
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @body    {Array} questions - Array of questions to add
 * @returns {Object} Updated quiz
 */
router.post(
  "/:id/questions",
  validateParams(quizSchemas.quizId),
  validateBody(quizSchemas.addQuestions),
  addQuestions
);

/**
 * @route   PUT /api/web/quizzes/:id/questions/:questionId
 * @desc    Update a specific question
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @param   {string} questionId - Question ID
 * @body    {Object} Question data to update
 * @returns {Object} Updated quiz
 */
router.put(
  "/:id/questions/:questionId",
  validateParams(quizSchemas.questionParams),
  validateBody(quizSchemas.updateQuestion),
  updateQuestion
);

/**
 * @route   DELETE /api/web/quizzes/:id/questions/:questionId
 * @desc    Delete a specific question
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @param   {string} questionId - Question ID
 * @returns {Object} Updated quiz
 */
router.delete(
  "/:id/questions/:questionId",
  validateParams(quizSchemas.questionParams),
  deleteQuestion
);

/**
 * @route   GET /api/web/quizzes/:id
 * @desc    Get single quiz by ID (with all details including questions)
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @returns {Object} Quiz details
 */
router.get("/:id", validateParams(quizSchemas.quizId), getQuizById);

/**
 * @route   PUT /api/web/quizzes/:id
 * @desc    Update quiz
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @body    {Object} Updated quiz data
 * @returns {Object} Updated quiz
 */
router.put(
  "/:id",
  validateParams(quizSchemas.quizId),
  validateBody(quizSchemas.update),
  updateQuiz
);

/**
 * @route   DELETE /api/web/quizzes/:id
 * @desc    Soft delete quiz
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @returns {Object} Success message
 */
router.delete("/:id", validateParams(quizSchemas.quizId), deleteQuiz);

/**
 * @route   POST /api/web/quizzes/:id/restore
 * @desc    Restore soft deleted quiz
 * @access  Admin
 * @param   {string} id - Quiz ID
 * @returns {Object} Restored quiz
 */
router.post("/:id/restore", validateParams(quizSchemas.quizId), restoreQuiz);

/**
 * @route   DELETE /api/web/quizzes/:id/permanent
 * @desc    Permanently delete quiz (cannot be undone)
 * @access  Super Admin only
 * @param   {string} id - Quiz ID
 * @returns {Object} Success message
 */
router.delete(
  "/:id/permanent",
  isSuperAdmin,
  validateParams(quizSchemas.quizId),
  permanentDeleteQuiz
);

export default router;
