/**
 * @fileoverview Feature pricing admin routes
 * Admin CRUD operations for feature pricing
 * @module routes/featurePricingAdmin
 */

import express from 'express';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, schemas } from '../../middleware/validation.middleware.js';
import { featurePricingSchemas } from './featureRequest.validation.js';
import {
  createFeaturePricing,
  getAllFeaturePricing,
  getSingleFeaturePricing,
  updateFeaturePricing,
  deleteFeaturePricing,
  restoreFeaturePricing,
} from './featurePricing.controller.js';
import Joi from 'joi';

const router = express.Router();

// Common pricing ID validation schema
const pricingIdSchema = Joi.object({
  id: schemas.mongoId.required(),
});

/**
 * ADMIN ROUTES (Authentication + Admin role required)
 */

/**
 * @route   GET /api/admin/feature-pricing
 * @desc    Get all feature pricing options
 * @access  Admin
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  getAllFeaturePricing
);

/**
 * @route   POST /api/admin/feature-pricing
 * @desc    Create new feature pricing
 * @access  Admin
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  validateBody(featurePricingSchemas.create),
  createFeaturePricing
);

/**
 * @route   GET /api/admin/feature-pricing/:id
 * @desc    Get single feature pricing by ID
 * @access  Admin
 */
router.get(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(pricingIdSchema),
  getSingleFeaturePricing
);

/**
 * @route   PUT /api/admin/feature-pricing/:id
 * @desc    Update feature pricing
 * @access  Admin
 */
router.put(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(pricingIdSchema),
  validateBody(featurePricingSchemas.update),
  updateFeaturePricing
);

/**
 * @route   DELETE /api/admin/feature-pricing/:id
 * @desc    Delete feature pricing (soft delete)
 * @access  Admin
 */
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  validateParams(pricingIdSchema),
  deleteFeaturePricing
);

/**
 * @route   POST /api/admin/feature-pricing/:id/restore
 * @desc    Restore deleted feature pricing
 * @access  Admin
 */
router.post(
  '/:id/restore',
  authenticate,
  isAdmin,
  validateParams(pricingIdSchema),
  restoreFeaturePricing
);

export default router;
