/**
 * @fileoverview Admin voucher routes with full CRUD operations
 * @module routes/admin/voucher
 */

import express from 'express';
import {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  enableVoucher,
  disableVoucher,
  deleteVoucher,
  getDeletedVouchers,
  restoreVoucher,
  permanentDeleteVoucher
} from './voucher.controller.js';
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, voucherSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/vouchers
 * @desc    Create a new voucher
 * @access  Admin
 */
router.post(
  '/',
  validateBody(voucherSchemas.create),
  createVoucher
);

/**
 * @route   GET /api/web/vouchers
 * @desc    Get all vouchers with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  validateQuery(voucherSchemas.list),
  getAllVouchers
);

/**
 * @route   GET /api/web/vouchers/deleted
 * @desc    Get all soft deleted vouchers
 * @access  Admin
 */
router.get(
  '/deleted',
  getDeletedVouchers
);

/**
 * @route   GET /api/web/vouchers/:id
 * @desc    Get single voucher by ID
 * @access  Admin
 */
router.get(
  '/:id',
  validateParams(voucherSchemas.voucherId),
  getVoucherById
);

/**
 * @route   PUT /api/web/vouchers/:id
 * @desc    Update voucher
 * @access  Admin
 */
router.put(
  '/:id',
  validateParams(voucherSchemas.voucherId),
  validateBody(voucherSchemas.update),
  updateVoucher
);

/**
 * @route   POST /api/web/vouchers/:id/enable
 * @desc    Enable voucher
 * @access  Admin
 */
router.post(
  '/:id/enable',
  validateParams(voucherSchemas.voucherId),
  enableVoucher
);

/**
 * @route   POST /api/web/vouchers/:id/disable
 * @desc    Disable voucher
 * @access  Admin
 */
router.post(
  '/:id/disable',
  validateParams(voucherSchemas.voucherId),
  disableVoucher
);

/**
 * @route   DELETE /api/web/vouchers/:id
 * @desc    Soft delete voucher
 * @access  Admin
 */
router.delete(
  '/:id',
  validateParams(voucherSchemas.voucherId),
  deleteVoucher
);

/**
 * @route   POST /api/web/vouchers/:id/restore
 * @desc    Restore soft deleted voucher
 * @access  Admin
 */
router.post(
  '/:id/restore',
  validateParams(voucherSchemas.voucherId),
  restoreVoucher
);

/**
 * @route   DELETE /api/web/vouchers/:id/permanent
 * @desc    Permanently delete voucher (cannot be undone)
 * @access  Super Admin only
 */
router.delete(
  '/:id/permanent',
  isSuperAdmin,
  validateParams(voucherSchemas.voucherId),
  permanentDeleteVoucher
);

export default router;
