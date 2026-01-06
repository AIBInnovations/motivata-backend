/**
 * @fileoverview User membership routes
 * Handles user-facing routes for viewing and purchasing memberships
 * @module routes/app/membership
 */

import express from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
  membershipPlanSchemas,
  userMembershipSchemas
} from '../../middleware/validation.middleware.js';
import {
  getAllMembershipPlans,
  getMembershipPlanById,
  createMembershipPaymentOrder,
  getMyMemberships,
  checkMembershipStatus,
  checkActiveMembership
} from './membership.controller.js';

const router = express.Router();

/**
 * MEMBERSHIP PLAN ROUTES (User)
 */

/**
 * @route   GET /api/app/membership-plans
 * @desc    Get all active membership plans
 * @access  Public
 */
router.get(
  '/membership-plans',
  validateQuery(membershipPlanSchemas.list),
  getAllMembershipPlans
);

/**
 * @route   GET /api/app/membership-plans/:id
 * @desc    Get single active membership plan by ID
 * @access  Public
 */
router.get(
  '/membership-plans/:id',
  validateParams(membershipPlanSchemas.planId),
  getMembershipPlanById
);

/**
 * USER MEMBERSHIP ROUTES (User)
 */

/**
 * @route   POST /api/app/memberships/create-order
 * @desc    Create payment order for membership purchase
 * @access  User (authenticated)
 */
router.post(
  '/memberships/create-order',
  validateBody(userMembershipSchemas.createOrder),
  createMembershipPaymentOrder
);

/**
 * @route   GET /api/app/memberships/my-memberships
 * @desc    Get user's own memberships
 * @access  User (authenticated)
 */
router.get('/memberships/my-memberships', getMyMemberships);

/**
 * @route   POST /api/app/memberships/check-status
 * @desc    Check membership status by phone
 * @access  User (authenticated)
 */
router.post(
  '/memberships/check-status',
  validateBody(userMembershipSchemas.checkStatus),
  checkMembershipStatus
);

/**
 * @route   POST /api/app/memberships/check-active
 * @desc    Check active membership by phone or user ID
 * @access  User (authenticated)
 */
router.post(
  '/memberships/check-active',
  validateBody(userMembershipSchemas.checkActive),
  checkActiveMembership
);

export default router;
