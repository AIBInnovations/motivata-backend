/**
 * @fileoverview Admin Poll Routes
 * @module Poll/admin.route
 */

import express from "express";
import pollController from "./poll.admin.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  pollSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * All routes require admin authentication
 */
router.use(authenticate, isAdmin);

/**
 * POST /api/web/polls
 * Create a new poll for an event
 */
router.post("/", validateBody(pollSchemas.create), pollController.createPoll);

/**
 * GET /api/web/polls/event/:eventId
 * Get poll by event ID
 */
router.get(
  "/event/:eventId",
  validateParams(pollSchemas.eventId),
  pollController.getPollByEventId
);

/**
 * PUT /api/web/polls/:pollId
 * Update poll
 */
router.put(
  "/:pollId",
  validateParams(pollSchemas.pollId),
  validateBody(pollSchemas.update),
  pollController.updatePoll
);

/**
 * DELETE /api/web/polls/:pollId
 * Delete poll
 */
router.delete(
  "/:pollId",
  validateParams(pollSchemas.pollId),
  pollController.deletePoll
);

/**
 * GET /api/web/polls/:pollId/stats
 * Get poll statistics
 */
router.get(
  "/:pollId/stats",
  validateParams(pollSchemas.pollId),
  pollController.getPollStats
);

export default router;
