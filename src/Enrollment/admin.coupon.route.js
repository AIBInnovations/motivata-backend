/**
 * @fileoverview Admin coupon routes with full CRUD operations
 * @module routes/admin/coupon
 */

import express from 'express';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getDeletedCoupons,
  restoreCoupon,
  permanentDeleteCoupon
} from './coupon.controller.js';
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, couponSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/coupons
 * @desc    Create a new coupon
 * @access  Admin
 */
router.post(
  '/',
  validateBody(couponSchemas.create),
  createCoupon
);

/**
 * @route   GET /api/web/coupons
 * @desc    Get all coupons with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  validateQuery(couponSchemas.list),
  getAllCoupons
);

/**
 * @route   GET /api/web/coupons/deleted
 * @desc    Get all soft deleted coupons
 * @access  Admin
 */
router.get(
  '/deleted',
  getDeletedCoupons
);

/**
 * @route   GET /api/web/coupons/:id
 * @desc    Get single coupon by ID
 * @access  Admin
 */
router.get(
  '/:id',
  validateParams(couponSchemas.couponId),
  getCouponById
);

/**
 * @route   PUT /api/web/coupons/:id
 * @desc    Update coupon
 * @access  Admin
 */
router.put(
  '/:id',
  validateParams(couponSchemas.couponId),
  validateBody(couponSchemas.update),
  updateCoupon
);

/**
 * @route   DELETE /api/web/coupons/:id
 * @desc    Soft delete coupon
 * @access  Admin
 */
router.delete(
  '/:id',
  validateParams(couponSchemas.couponId),
  deleteCoupon
);

/**
 * @route   POST /api/web/coupons/:id/restore
 * @desc    Restore soft deleted coupon
 * @access  Admin
 */
router.post(
  '/:id/restore',
  validateParams(couponSchemas.couponId),
  restoreCoupon
);

/**
 * @route   DELETE /api/web/coupons/:id/permanent
 * @desc    Permanently delete coupon (cannot be undone)
 * @access  Super Admin only
 */
router.delete(
  '/:id/permanent',
  isSuperAdmin,
  validateParams(couponSchemas.couponId),
  permanentDeleteCoupon
);

export default router;
