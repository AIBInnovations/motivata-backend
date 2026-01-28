/**
 * @fileoverview Feature request routes
 * Handles both public (form submission) and admin (review/approve/reject) routes
 * @module routes/featureRequest
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, schemas } from '../../middleware/validation.middleware.js';
import { featureRequestSchemas } from './featureRequest.validation.js';
import {
  getFeaturePricing,
  submitFeatureRequest,
  withdrawFeatureRequest,
  getAllFeatureRequests,
  getSingleFeatureRequest,
  approveFeatureRequest,
  rejectFeatureRequest,
  resendPaymentLink,
  getPendingCount,
} from './featureRequest.controller.js';

const router = express.Router();

// Common request ID validation schema
const requestIdSchema = {
  id: schemas.mongoId.required(),
};

/**
 * PUBLIC ROUTES (No authentication required)
 * These routes are for the public form submission
 */

/**
 * @route   GET /api/web/feature-requests/pricing
 * @desc    Get available feature pricing options for form
 * @access  Public
 */
router.get('/pricing', getFeaturePricing);

/**
 * @route   POST /api/web/feature-requests
 * @desc    Submit a new feature access request
 * @access  Public
 */
router.post(
  '/',
  validateBody(featureRequestSchemas.submit),
  submitFeatureRequest
);

/**
 * @route   POST /api/web/feature-requests/:id/withdraw
 * @desc    Withdraw a pending feature request
 * @access  Public (requires phone verification)
 */
router.post(
  '/:id/withdraw',
  validateBody(featureRequestSchemas.withdraw),
  withdrawFeatureRequest
);

/**
 * ADMIN ROUTES (Authentication + Admin role required)
 * These routes are for admin panel operations
 */

/**
 * @route   GET /api/web/feature-requests/pending-count
 * @desc    Get count of pending requests
 * @access  Admin
 */
router.get(
  '/pending-count',
  authenticate,
  isAdmin,
  getPendingCount
);

/**
 * @route   GET /api/web/feature-requests
 * @desc    Get all feature requests with filters
 * @access  Admin
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  validateQuery(featureRequestSchemas.list),
  getAllFeatureRequests
);

/**
 * @route   GET /api/web/feature-requests/:id
 * @desc    Get single feature request by ID
 * @access  Admin
 */
router.get(
  '/:id',
  authenticate,
  isAdmin,
  getSingleFeatureRequest
);

/**
 * @route   POST /api/web/feature-requests/:id/approve
 * @desc    Approve feature request and send payment link
 * @access  Admin
 */
router.post(
  '/:id/approve',
  authenticate,
  isAdmin,
  validateBody(featureRequestSchemas.approve),
  approveFeatureRequest
);

/**
 * @route   POST /api/web/feature-requests/:id/reject
 * @desc    Reject feature request
 * @access  Admin
 */
router.post(
  '/:id/reject',
  authenticate,
  isAdmin,
  validateBody(featureRequestSchemas.reject),
  rejectFeatureRequest
);

/**
 * @route   POST /api/web/feature-requests/:id/resend-link
 * @desc    Resend payment link for approved request
 * @access  Admin
 */
router.post(
  '/:id/resend-link',
  authenticate,
  isAdmin,
  resendPaymentLink
);

export default router;
