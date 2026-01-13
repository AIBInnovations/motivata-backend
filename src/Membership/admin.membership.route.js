/**
 * @fileoverview Admin membership routes
 * Handles admin routes for membership plan and user membership management
 * @module routes/admin/membership
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  membershipPlanSchemas,
  userMembershipSchemas
} from '../../middleware/validation.middleware.js';
import {
  createMembershipPlan,
  getAllMembershipPlans,
  getMembershipPlanById,
  updateMembershipPlan,
  deleteMembershipPlan,
  restoreMembershipPlan,
  createUserMembershipAdmin,
  getAllUserMemberships,
  getUserMembershipById,
  extendUserMembership,
  cancelUserMembership,
  updateMembershipNotes,
  deleteUserMembership,
  checkMembershipStatus
} from './membership.controller.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * MEMBERSHIP PLAN ROUTES (Admin)
 */

/**
 * @route   POST /api/admin/membership-plans
 * @desc    Create new membership plan
 * @access  Admin
 */
router.post(
  '/membership-plans',
  validateBody(membershipPlanSchemas.create),
  createMembershipPlan
);

/**
 * @route   GET /api/admin/membership-plans
 * @desc    Get all membership plans (including inactive)
 * @access  Admin
 */
router.get(
  '/membership-plans',
  validateQuery(membershipPlanSchemas.list),
  getAllMembershipPlans
);

/**
 * @route   GET /api/admin/membership-plans/:id
 * @desc    Get single membership plan by ID
 * @access  Admin
 */
router.get(
  '/membership-plans/:id',
  validateParams(membershipPlanSchemas.planId),
  getMembershipPlanById
);

/**
 * @route   PUT /api/admin/membership-plans/:id
 * @desc    Update membership plan
 * @access  Admin
 */
router.put(
  '/membership-plans/:id',
  validateParams(membershipPlanSchemas.planId),
  validateBody(membershipPlanSchemas.update),
  updateMembershipPlan
);

/**
 * @route   DELETE /api/admin/membership-plans/:id
 * @desc    Delete membership plan (soft delete)
 * @access  Admin
 */
router.delete(
  '/membership-plans/:id',
  validateParams(membershipPlanSchemas.planId),
  deleteMembershipPlan
);

/**
 * @route   POST /api/admin/membership-plans/:id/restore
 * @desc    Restore deleted membership plan
 * @access  Admin
 */
router.post(
  '/membership-plans/:id/restore',
  validateParams(membershipPlanSchemas.planId),
  restoreMembershipPlan
);

/**
 * USER MEMBERSHIP ROUTES (Admin)
 */

/**
 * @route   POST /api/admin/user-memberships
 * @desc    Create user membership (admin/offline purchase)
 * @access  Admin
 */
router.post(
  '/user-memberships',
  validateBody(userMembershipSchemas.createAdmin),
  createUserMembershipAdmin
);

/**
 * @route   GET /api/admin/user-memberships
 * @desc    Get all user memberships with filters
 * @access  Admin
 */
router.get(
  '/user-memberships',
  validateQuery(userMembershipSchemas.list),
  getAllUserMemberships
);

/**
 * @route   POST /api/admin/user-memberships/check-status
 * @desc    Check membership status by phone
 * @access  Admin
 */
router.post(
  '/user-memberships/check-status',
  validateBody(userMembershipSchemas.checkStatus),
  checkMembershipStatus
);

/**
 * @route   GET /api/admin/user-memberships/:id
 * @desc    Get single user membership by ID
 * @access  Admin
 */
router.get(
  '/user-memberships/:id',
  validateParams(userMembershipSchemas.membershipId),
  getUserMembershipById
);

/**
 * @route   POST /api/admin/user-memberships/:id/extend
 * @desc    Extend user membership duration
 * @access  Admin
 */
router.post(
  '/user-memberships/:id/extend',
  validateParams(userMembershipSchemas.membershipId),
  validateBody(userMembershipSchemas.extend),
  extendUserMembership
);

/**
 * @route   POST /api/admin/user-memberships/:id/cancel
 * @desc    Cancel user membership
 * @access  Admin
 */
router.post(
  '/user-memberships/:id/cancel',
  validateParams(userMembershipSchemas.membershipId),
  validateBody(userMembershipSchemas.cancel),
  cancelUserMembership
);

/**
 * @route   PATCH /api/admin/user-memberships/:id/notes
 * @desc    Update admin notes for membership
 * @access  Admin
 */
router.patch(
  '/user-memberships/:id/notes',
  validateParams(userMembershipSchemas.membershipId),
  validateBody(userMembershipSchemas.updateNotes),
  updateMembershipNotes
);

/**
 * @route   DELETE /api/admin/user-memberships/:id
 * @desc    Delete user membership (soft delete)
 * @access  Admin
 */
router.delete(
  '/user-memberships/:id',
  validateParams(userMembershipSchemas.membershipId),
  deleteUserMembership
);

export default router;
