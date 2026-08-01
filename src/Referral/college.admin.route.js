/**
 * @fileoverview College admin routes
 * @module routes/admin/college
 */

import express from 'express';
import {
  createCollege,
  getAllColleges,
  getCollegeById,
  updateCollege,
  deleteCollege,
  getCollegeReport,
} from './college.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  collegeSchemas,
} from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * Every college route is admin-only.
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/colleges/report
 * @desc    Students per college, from paid referral-tagged memberships
 * @access  Admin
 *
 * MUST stay above GET /:id — otherwise "report" is parsed as an id.
 */
router.get('/report', getCollegeReport);

/**
 * @route   POST /api/web/colleges
 * @desc    Create a college
 * @access  Admin
 */
router.post('/', validateBody(collegeSchemas.create), createCollege);

/**
 * @route   GET /api/web/colleges
 * @desc    List colleges with filters and pagination
 * @access  Admin
 */
router.get('/', validateQuery(collegeSchemas.list), getAllColleges);

/**
 * @route   GET /api/web/colleges/:id
 * @desc    Get a single college
 * @access  Admin
 */
router.get('/:id', validateParams(collegeSchemas.collegeId), getCollegeById);

/**
 * @route   PUT /api/web/colleges/:id
 * @desc    Update a college
 * @access  Admin
 */
router.put(
  '/:id',
  validateParams(collegeSchemas.collegeId),
  validateBody(collegeSchemas.update),
  updateCollege
);

/**
 * @route   DELETE /api/web/colleges/:id
 * @desc    Soft delete a college
 * @access  Admin
 */
router.delete('/:id', validateParams(collegeSchemas.collegeId), deleteCollege);

export default router;
