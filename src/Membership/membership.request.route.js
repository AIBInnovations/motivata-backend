/**
 * @fileoverview Membership request routes
 * Handles both public (form submission) and admin (review/approve/reject) routes
 * @module routes/membershipRequest
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  membershipRequestSchemas,
} from '../../middleware/validation.middleware.js';
import {
  submitMembershipRequest,
  getPlansForRequestForm,
  getAllMembershipRequests,
  getMembershipRequestById,
  approveMembershipRequest,
  rejectMembershipRequest,
  resendPaymentLink,
  getPendingCount,
  withdrawMembershipRequest,
} from './membership.request.controller.js';
import { getMembershipStats } from './membership.controller.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 * These routes are for the public form submission
 */

/**
 * @route   GET /api/web/membership-requests/plans
 * @desc    Get available membership plans for form dropdown
 * @access  Public
 */
router.get('/plans', getPlansForRequestForm);

/**
 * @route   GET /api/web/membership-requests/stats
 * @desc    Get membership availability statistics
 * @access  Public
 */
router.get('/stats', getMembershipStats);

/**
 * @route   POST /api/web/membership-requests
 * @desc    Submit a new membership request
 * @access  Public
 */
router.post(
  '/',
  validateBody(membershipRequestSchemas.submit),
  submitMembershipRequest
);

/**
 * @route   POST /api/web/membership-requests/:id/withdraw
 * @desc    Withdraw a pending membership request
 * @access  Public (requires phone verification)
 */
router.post(
  '/:id/withdraw',
  validateParams(membershipRequestSchemas.requestId),
  withdrawMembershipRequest
);

/**
 * ADMIN ROUTES (Authentication + Admin role required)
 * These routes are for admin panel operations
 */

/**
 * @route   GET /api/web/membership-requests/pending-count
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
 * @route   GET /api/web/membership-requests
 * @desc    Get all membership requests with filters
 * @access  Admin
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  validateQuery(membershipRequestSchemas.list),
  getAllMembershipRequests
);

/**
 * @route   GET /api/web/membership-requests/:id
 * @desc    Get single membership request by ID
 * @access  Admin
 */
router.get(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(membershipRequestSchemas.requestId),
  getMembershipRequestById
);

/**
 * @route   POST /api/web/membership-requests/:id/approve
 * @desc    Approve membership request and send payment link
 * @access  Admin
 */
router.post(
  '/:id/approve',
  authenticate,
  isAdmin,
  validateParams(membershipRequestSchemas.requestId),
  validateBody(membershipRequestSchemas.approve),
  approveMembershipRequest
);

/**
 * @route   POST /api/web/membership-requests/:id/reject
 * @desc    Reject membership request
 * @access  Admin
 */
router.post(
  '/:id/reject',
  authenticate,
  isAdmin,
  validateParams(membershipRequestSchemas.requestId),
  validateBody(membershipRequestSchemas.reject),
  rejectMembershipRequest
);

/**
 * @route   POST /api/web/membership-requests/:id/resend-link
 * @desc    Resend payment link for approved request
 * @access  Admin
 */
router.post(
  '/:id/resend-link',
  authenticate,
  isAdmin,
  validateParams(membershipRequestSchemas.requestId),
  resendPaymentLink
);

export default router;
