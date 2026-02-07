/**
 * @fileoverview Motivata Blend routes
 * Handles registration requests for weekly Wednesday Motivata Blend sessions
 * @module routes/motivataBlend
 */

import express from 'express';
import { validateBody, motivataBlendSchemas } from '../../middleware/validation.middleware.js';
import { submitMotivataBlendRequest } from './motivataBlend.controller.js';
import { getActiveBanner } from './motivataBlendBanner.controller.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

/**
 * @route   GET /api/web/motivata-blend/banner
 * @desc    Get the current active Motivata Blend banner
 * @access  Public
 */
router.get('/banner', getActiveBanner);

/**
 * @route   POST /api/web/motivata-blend/requests
 * @desc    Submit a new Motivata Blend registration request
 * @access  Public
 */
router.post(
  '/requests',
  validateBody(motivataBlendSchemas.submit),
  submitMotivataBlendRequest
);

export default router;
