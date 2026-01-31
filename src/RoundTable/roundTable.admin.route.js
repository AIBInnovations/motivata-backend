/**
 * @fileoverview Round Table admin routes
 * Handles admin operations for Round Table registration requests
 * @module routes/roundTable/admin
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  roundTableSchemas
} from '../../middleware/validation.middleware.js';
import {
  getAllRoundTableRequests,
  getRoundTableRequestById,
  approveRoundTableRequest,
  rejectRoundTableRequest,
  getRoundTableStats,
  getPendingCount
} from './roundTable.admin.controller.js';

const router = express.Router();

/**
 * All routes require authentication + admin role
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/round-table/admin/stats
 * @desc    Get Round Table statistics
 * @access  Admin
 */
router.get('/stats', getRoundTableStats);

/**
 * @route   GET /api/web/round-table/admin/pending-count
 * @desc    Get pending requests count
 * @access  Admin
 */
router.get('/pending-count', getPendingCount);

/**
 * @route   GET /api/web/round-table/admin/requests
 * @desc    Get all Round Table requests with filters
 * @access  Admin
 */
router.get(
  '/requests',
  validateQuery(roundTableSchemas.list),
  getAllRoundTableRequests
);

/**
 * @route   GET /api/web/round-table/admin/requests/:id
 * @desc    Get single Round Table request by ID
 * @access  Admin
 */
router.get(
  '/requests/:id',
  validateParams(roundTableSchemas.requestId),
  getRoundTableRequestById
);

/**
 * @route   POST /api/web/round-table/admin/requests/:id/approve
 * @desc    Approve a Round Table request
 * @access  Admin
 */
router.post(
  '/requests/:id/approve',
  validateParams(roundTableSchemas.requestId),
  validateBody(roundTableSchemas.approve),
  approveRoundTableRequest
);

/**
 * @route   POST /api/web/round-table/admin/requests/:id/reject
 * @desc    Reject a Round Table request
 * @access  Admin
 */
router.post(
  '/requests/:id/reject',
  validateParams(roundTableSchemas.requestId),
  validateBody(roundTableSchemas.reject),
  rejectRoundTableRequest
);

export default router;
