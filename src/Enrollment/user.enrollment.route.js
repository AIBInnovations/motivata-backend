/**
 * @fileoverview User enrollment routes for managing personal enrollments
 * @module routes/user/enrollment
 */

import express from 'express';
import {
  createEnrollment,
  getUserEnrollments,
  getEnrollmentById,
  cancelEnrollment,
  checkEnrollmentStatus,
  createMockEnrollment
} from './eventEnrollment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, enrollmentSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/app/enrollments/mock-enrollment
 * @desc    Create mock enrollment without payment flow (for testing)
 * @access  Authenticated User
 */
router.post(
  '/mock-enrollment',
  validateBody(enrollmentSchemas.mockCreate),
  createMockEnrollment
);

/**
 * @route   POST /api/app/enrollments
 * @desc    Create enrollment after successful payment
 * @access  Authenticated User
 */
router.post(
  '/',
  validateBody(enrollmentSchemas.create),
  createEnrollment
);

/**
 * @route   GET /api/app/enrollments
 * @desc    Get user's enrollments
 * @access  Authenticated User
 */
router.get(
  '/',
  validateQuery(enrollmentSchemas.list),
  getUserEnrollments
);

/**
 * @route   GET /api/app/enrollments/check/:eventId
 * @desc    Check if user is enrolled in an event
 * @access  Authenticated User
 */
router.get(
  '/check/:eventId',
  checkEnrollmentStatus
);

/**
 * @route   GET /api/app/enrollments/:id
 * @desc    Get single enrollment by ID
 * @access  Authenticated User
 */
router.get(
  '/:id',
  validateParams(enrollmentSchemas.enrollmentId),
  getEnrollmentById
);

/**
 * @route   POST /api/app/enrollments/:id/cancel
 * @desc    Cancel own enrollment
 * @access  Authenticated User
 */
router.post(
  '/:id/cancel',
  validateParams(enrollmentSchemas.enrollmentId),
  validateBody(enrollmentSchemas.cancel),
  cancelEnrollment
);

export default router;
