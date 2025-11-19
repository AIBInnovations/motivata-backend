/**
 * @fileoverview Admin enrollment routes for managing all enrollments
 * @module routes/admin/enrollment
 */

import express from 'express';
import {
  getAllEnrollments,
  getEnrollmentById,
  getEventAttendees,
  cancelEnrollment
} from './eventEnrollment.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, enrollmentSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/enrollments
 * @desc    Get all enrollments with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  validateQuery(enrollmentSchemas.list),
  getAllEnrollments
);

/**
 * @route   GET /api/web/enrollments/event/:eventId
 * @desc    Get all attendees for a specific event
 * @access  Admin
 */
router.get(
  '/event/:eventId',
  validateQuery(enrollmentSchemas.list),
  getEventAttendees
);

/**
 * @route   GET /api/web/enrollments/:id
 * @desc    Get single enrollment by ID
 * @access  Admin
 */
router.get(
  '/:id',
  validateParams(enrollmentSchemas.enrollmentId),
  getEnrollmentById
);

/**
 * @route   POST /api/web/enrollments/:id/cancel
 * @desc    Cancel enrollment (admin can cancel any enrollment)
 * @access  Admin
 */
router.post(
  '/:id/cancel',
  validateParams(enrollmentSchemas.enrollmentId),
  validateBody(enrollmentSchemas.cancel),
  cancelEnrollment
);

export default router;
