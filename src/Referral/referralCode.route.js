/**
 * @fileoverview Referral code routes — public validation + admin CRUD.
 *
 * The public validate endpoint sits on this router (not behind auth) because
 * the student form has to check the code before any payment starts. The admin
 * routes below it apply auth individually rather than via router.use(), so the
 * public route stays reachable.
 *
 * @module routes/referralCode
 */

import express from 'express';
import {
  createReferralCode,
  getAllReferralCodes,
  getReferralCodeById,
  updateReferralCode,
  deleteReferralCode,
  validateReferralCode,
  getPublicColleges,
} from './referralCode.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  referralCodeSchemas,
} from '../../middleware/validation.middleware.js';
import { publicFormLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (no authentication)
 *
 * Both MUST stay above GET /:id — otherwise "validate" and "colleges" are
 * parsed as ids.
 */

/**
 * @route   POST /api/web/referral-codes/validate
 * @desc    Verify a referral code before payment. Does NOT consume a use.
 * @access  Public
 */
router.post(
  '/validate',
  publicFormLimiter,
  validateBody(referralCodeSchemas.validate),
  validateReferralCode
);

/**
 * @route   GET /api/web/referral-codes/colleges
 * @desc    Active colleges, for a public dropdown
 * @access  Public
 */
router.get('/colleges', getPublicColleges);

/**
 * ADMIN ROUTES (authentication + admin role)
 */

/**
 * @route   POST /api/web/referral-codes
 * @desc    Create a referral code against a college
 * @access  Admin
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  validateBody(referralCodeSchemas.create),
  createReferralCode
);

/**
 * @route   GET /api/web/referral-codes
 * @desc    List referral codes with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  validateQuery(referralCodeSchemas.list),
  getAllReferralCodes
);

/**
 * @route   GET /api/web/referral-codes/:id
 * @desc    Get a single referral code
 * @access  Admin
 */
router.get(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(referralCodeSchemas.referralCodeId),
  getReferralCodeById
);

/**
 * @route   PUT /api/web/referral-codes/:id
 * @desc    Update a referral code
 * @access  Admin
 */
router.put(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(referralCodeSchemas.referralCodeId),
  validateBody(referralCodeSchemas.update),
  updateReferralCode
);

/**
 * @route   DELETE /api/web/referral-codes/:id
 * @desc    Soft delete a referral code
 * @access  Admin
 */
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(referralCodeSchemas.referralCodeId),
  deleteReferralCode
);

export default router;
