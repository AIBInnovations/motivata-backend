/**
 * @fileoverview Event Request public routes
 * Handles invite-only event registration requests submitted by the public
 * @module routes/eventRequest
 */

import express from 'express';
import { validateBody, eventRequestSchemas } from '../../middleware/validation.middleware.js';
import { publicFormLimiter } from '../../middleware/rateLimit.middleware.js';
import { submitEventRequest } from './eventRequest.controller.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

/**
 * @route   POST /api/web/event-requests/requests
 * @desc    Submit a new event invite request
 * @access  Public
 */
router.post(
  '/requests',
  publicFormLimiter,
  validateBody(eventRequestSchemas.submit),
  submitEventRequest
);

export default router;
