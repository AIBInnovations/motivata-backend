/**
 * @fileoverview Doer request routes ("Become a Doer" form)
 *
 * A Doer request is a membership request in the DOER queue: same controller,
 * same approve → Razorpay → WhatsApp → webhook → UserMembership path. The only
 * difference is `req.requestType`, pinned below, which scopes every query to
 * DOER plans and DOER requests.
 *
 * @module routes/doerRequest
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  membershipRequestSchemas,
} from '../../middleware/validation.middleware.js';
import { publicFormLimiter } from '../../middleware/rateLimit.middleware.js';
import {
  createDoerCheckout,
  previewCoupon,
  getPlansForRequestForm,
  getAllMembershipRequests,
  getMembershipRequestById,
  approveMembershipRequest,
  rejectMembershipRequest,
  resendPaymentLink,
  getPendingCount,
} from './membership.request.controller.js';

const router = express.Router();

/**
 * Pin every request on this router to the DOER queue. The membership router
 * leaves req.requestType unset, so it keeps defaulting to MEMBERSHIP.
 */
router.use((req, res, next) => {
  req.requestType = 'DOER';
  next();
});

/**
 * PUBLIC ROUTES (No authentication required)
 */

/**
 * @route   GET /api/web/doer-requests/plans
 * @desc    Get available Doer plans for the form dropdown
 * @access  Public
 */
router.get('/plans', getPlansForRequestForm);

/**
 * @route   POST /api/web/doer-requests/validate-coupon
 * @desc    Preview a coupon against a Doer plan, before paying
 * @access  Public
 */
router.post('/validate-coupon', publicFormLimiter, previewCoupon);

/**
 * @route   POST /api/web/doer-requests/checkout
 * @desc    Buy a Doer plan outright — creates a Razorpay order, no admin approval
 * @access  Public
 *
 * There is deliberately no "submit a Doer request" endpoint. A Doer pays on the
 * spot; the admin queue is a record of purchases, not a queue of approvals.
 */
router.post('/checkout', publicFormLimiter, createDoerCheckout);

/**
 * ADMIN ROUTES (Authentication + Admin role required)
 */

/**
 * @route   GET /api/web/doer-requests/pending-count
 * @desc    Get count of pending Doer requests
 * @access  Admin
 *
 * MUST stay above GET /:id — otherwise "pending-count" is parsed as an id.
 */
router.get(
  '/pending-count',
  authenticate,
  isAdmin,
  getPendingCount
);

/**
 * @route   GET /api/web/doer-requests
 * @desc    Get all Doer requests with filters
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
 * @route   GET /api/web/doer-requests/:id
 * @desc    Get a single Doer request by ID
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
 * @route   POST /api/web/doer-requests/:id/approve
 * @desc    Approve a Doer request and send the payment link
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
 * @route   POST /api/web/doer-requests/:id/reject
 * @desc    Reject a Doer request
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
 * @route   POST /api/web/doer-requests/:id/resend-link
 * @desc    Resend the payment link for an approved Doer request
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
