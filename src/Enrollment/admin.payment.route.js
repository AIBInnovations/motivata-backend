/**
 * @fileoverview Admin payment routes for viewing all payments
 * @module routes/admin/payment
 */

import express from 'express';
import {
  getAllPayments,
  getPaymentById
} from './payment.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateParams, validateQuery, paymentSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/payments
 * @desc    Get all payments with filters and pagination
 * @access  Admin
 */
router.get(
  '/',
  validateQuery(paymentSchemas.list),
  getAllPayments
);

/**
 * @route   GET /api/web/payments/:id
 * @desc    Get single payment by ID
 * @access  Admin
 */
router.get(
  '/:id',
  validateParams(paymentSchemas.paymentId),
  getPaymentById
);

export default router;
