/**
 * @fileoverview User payment routes for creating and managing payments
 * @module routes/user/payment
 */

import express from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  getUserPayments,
  getPaymentById,
  handlePaymentFailure
} from './payment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery, paymentSchemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/app/payments/create-order
 * @desc    Create a new payment order
 * @access  Authenticated User
 */
router.post(
  '/create-order',
  validateBody(paymentSchemas.createOrder),
  createPaymentOrder
);

/**
 * @route   POST /api/app/payments/verify
 * @desc    Verify payment after successful transaction
 * @access  Authenticated User
 */
router.post(
  '/verify',
  validateBody(paymentSchemas.verifyPayment),
  verifyPayment
);

/**
 * @route   POST /api/app/payments/failure
 * @desc    Handle payment failure
 * @access  Authenticated User
 */
router.post(
  '/failure',
  handlePaymentFailure
);

/**
 * @route   GET /api/app/payments
 * @desc    Get user's payment history
 * @access  Authenticated User
 */
router.get(
  '/',
  validateQuery(paymentSchemas.list),
  getUserPayments
);

/**
 * @route   GET /api/app/payments/:id
 * @desc    Get single payment by ID
 * @access  Authenticated User
 */
router.get(
  '/:id',
  validateParams(paymentSchemas.paymentId),
  getPaymentById
);

export default router;
