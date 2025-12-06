/**
 * @fileoverview User Poll Routes
 * @module Poll/user.route
 */

import express from "express";
import pollController from "./poll.user.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  pollSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * All routes require user authentication
 */
router.use(authenticate);

/**
 * GET /api/app/polls/event/:eventId
 * Get poll for an event (user must be enrolled)
 */
router.get(
  "/event/:eventId",
  validateParams(pollSchemas.eventId),
  pollController.getPollByEventId
);

/**
 * POST /api/app/polls/:pollId/submit
 * Submit poll answers
 */
router.post(
  "/:pollId/submit",
  validateParams(pollSchemas.pollId),
  validateBody(pollSchemas.submit),
  pollController.submitPoll
);

export default router;
