/**
 * @fileoverview Motivata Blend routes
 * Handles registration requests for weekly Wednesday Motivata Blend sessions
 * @module routes/motivataBlend
 */

import express from 'express';
import { validateBody, motivataBlendSchemas } from '../../middleware/validation.middleware.js';
import { submitMotivataBlendRequest } from './motivataBlend.controller.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

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
