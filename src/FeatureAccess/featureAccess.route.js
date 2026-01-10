/**
 * @fileoverview Feature Access routes
 * Admin routes for managing feature access control
 * @module routes/featureAccess
 */

import express from 'express';
import {
  getAllFeatureAccess,
  updateFeatureAccess,
  checkFeatureAccess,
} from './featureAccess.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { featureAccessSchemas } from './featureAccess.validation.js';

const router = express.Router();

/**
 * @route   GET /api/web/feature-access
 * @desc    Get all feature access settings
 * @access  Admin
 */
router.get('/feature-access', authenticate, isAdmin, getAllFeatureAccess);

/**
 * @route   PUT /api/web/feature-access
 * @desc    Update feature access settings (create or update)
 * @access  Admin
 */
router.put(
  '/feature-access',
  authenticate,
  isAdmin,
  validateBody(featureAccessSchemas.update),
  updateFeatureAccess
);

/**
 * @route   POST /api/web/feature-access/check
 * @desc    Check if user has access to a feature
 * @access  Public
 */
router.post(
  '/feature-access/check',
  validateBody(featureAccessSchemas.check),
  checkFeatureAccess
);

export default router;
