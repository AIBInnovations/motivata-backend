/**
 * @fileoverview Round Table routes
 * Handles registration requests for exclusive Round Table gatherings
 * @module routes/roundTable
 */

import express from 'express';
import { validateBody, roundTableSchemas } from '../../middleware/validation.middleware.js';
import { submitRoundTableRequest } from './roundTable.controller.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

/**
 * @route   POST /api/web/round-table/requests
 * @desc    Submit a new Round Table registration request
 * @access  Public
 */
router.post(
  '/requests',
  validateBody(roundTableSchemas.submit),
  submitRoundTableRequest
);

export default router;
