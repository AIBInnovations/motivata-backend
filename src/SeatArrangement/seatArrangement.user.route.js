/**
 * @fileoverview User routes for seat arrangement viewing
 * @module routes/user/seatArrangement
 */

import express from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  seatArrangementSchemas,
} from "../../middleware/validation.middleware.js";
import {
  getSeatArrangement,
  getAvailableSeats,
} from "./seatArrangement.controller.js";

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/app/events/:eventId/available-seats
 * @desc    Get available seats for selection (must be defined before /:eventId/seat-arrangement)
 * @access  User
 */
router.get(
  "/:eventId/available-seats",
  validateParams(seatArrangementSchemas.eventIdParam),
  getAvailableSeats
);

/**
 * @route   GET /api/app/events/:eventId/seat-arrangement
 * @desc    Get seat arrangement (filtered for users)
 * @access  User
 */
router.get(
  "/:eventId/seat-arrangement",
  validateParams(seatArrangementSchemas.eventIdParam),
  getSeatArrangement
);

export default router;
