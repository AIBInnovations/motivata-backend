/**
 * @fileoverview User coupon routes for viewing and validating coupons
 * @module routes/user/coupon
 */

import express from 'express';
import {
  getActiveCoupons,
  validateCoupon
} from './coupon.controller.js';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware.js';
import { validateBody, couponSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/app/coupons
 * @desc    Get all active coupons
 * @access  Public
 */
router.get(
  '/',
  getActiveCoupons
);

/**
 * @route   POST /api/app/coupons/validate
 * @desc    Validate coupon code and get discount
 * @access  Public (optional auth for user-specific validation)
 */
router.post(
  '/validate',
  optionalAuth,
  validateBody(couponSchemas.validate),
  validateCoupon
);

export default router;
