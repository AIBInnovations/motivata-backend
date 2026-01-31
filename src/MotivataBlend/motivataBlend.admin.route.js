/**
 * @fileoverview Motivata Blend admin routes
 * Handles admin operations for Motivata Blend registration requests
 * @module routes/motivataBlend/admin
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  motivataBlendSchemas
} from '../../middleware/validation.middleware.js';
import {
  getAllMotivataBlendRequests,
  getMotivataBlendRequestById,
  approveMotivataBlendRequest,
  rejectMotivataBlendRequest,
  getMotivataBlendStats,
  getPendingCount
} from './motivataBlend.admin.controller.js';

const router = express.Router();

/**
 * All routes require authentication + admin role
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/motivata-blend/admin/stats
 * @desc    Get Motivata Blend statistics
 * @access  Admin
 */
router.get('/stats', getMotivataBlendStats);

/**
 * @route   GET /api/web/motivata-blend/admin/pending-count
 * @desc    Get pending requests count
 * @access  Admin
 */
router.get('/pending-count', getPendingCount);

/**
 * @route   GET /api/web/motivata-blend/admin/requests
 * @desc    Get all Motivata Blend requests with filters
 * @access  Admin
 */
router.get(
  '/requests',
  validateQuery(motivataBlendSchemas.list),
  getAllMotivataBlendRequests
);

/**
 * @route   GET /api/web/motivata-blend/admin/requests/:id
 * @desc    Get single Motivata Blend request by ID
 * @access  Admin
 */
router.get(
  '/requests/:id',
  validateParams(motivataBlendSchemas.requestId),
  getMotivataBlendRequestById
);

/**
 * @route   POST /api/web/motivata-blend/admin/requests/:id/approve
 * @desc    Approve a Motivata Blend request
 * @access  Admin
 */
router.post(
  '/requests/:id/approve',
  validateParams(motivataBlendSchemas.requestId),
  validateBody(motivataBlendSchemas.approve),
  approveMotivataBlendRequest
);

/**
 * @route   POST /api/web/motivata-blend/admin/requests/:id/reject
 * @desc    Reject a Motivata Blend request
 * @access  Admin
 */
router.post(
  '/requests/:id/reject',
  validateParams(motivataBlendSchemas.requestId),
  validateBody(motivataBlendSchemas.reject),
  rejectMotivataBlendRequest
);

export default router;
