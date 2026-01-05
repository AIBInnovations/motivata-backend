/**
 * @fileoverview Admin routes for seat arrangement management
 * @module routes/admin/seatArrangement
 */

import express from "express";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  seatArrangementSchemas,
} from "../../middleware/validation.middleware.js";
import {
  createSeatArrangement,
  getSeatArrangement,
  updateSeatArrangement,
  deleteSeatArrangement,
} from "./seatArrangement.controller.js";

const router = express.Router();

/**
 * All routes require authentication and admin privileges
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/events/:eventId/seat-arrangement
 * @desc    Create seat arrangement for event
 * @access  Admin
 */
router.post(
  "/:eventId/seat-arrangement",
  validateParams(seatArrangementSchemas.eventIdParam),
  validateBody(seatArrangementSchemas.create),
  createSeatArrangement
);

/**
 * @route   GET /api/web/events/:eventId/seat-arrangement
 * @desc    Get seat arrangement for event
 * @access  Admin
 */
router.get(
  "/:eventId/seat-arrangement",
  validateParams(seatArrangementSchemas.eventIdParam),
  getSeatArrangement
);

/**
 * @route   PUT /api/web/events/:eventId/seat-arrangement
 * @desc    Update seat arrangement
 * @access  Admin
 */
router.put(
  "/:eventId/seat-arrangement",
  validateParams(seatArrangementSchemas.eventIdParam),
  validateBody(seatArrangementSchemas.update),
  updateSeatArrangement
);

/**
 * @route   DELETE /api/web/events/:eventId/seat-arrangement
 * @desc    Delete seat arrangement
 * @access  Admin
 */
router.delete(
  "/:eventId/seat-arrangement",
  validateParams(seatArrangementSchemas.eventIdParam),
  deleteSeatArrangement
);

export default router;
