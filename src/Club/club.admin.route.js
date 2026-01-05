/**
 * @fileoverview Admin club routes
 * @module routes/club/admin
 */

import express from "express";
import {
  createClub,
  getAllClubs,
  getClubById,
  updateClub,
  deleteClub,
  getClubStats,
} from "./club.admin.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  clubSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/clubs
 * @desc    Create a new club
 * @access  Admin only
 */
router.post("/", validateBody(clubSchemas.create), createClub);

/**
 * @route   GET /api/web/clubs
 * @desc    Get all clubs (admin view with all stats)
 * @access  Admin only
 */
router.get("/", validateQuery(clubSchemas.listAdmin), getAllClubs);

/**
 * @route   GET /api/web/clubs/:clubId
 * @desc    Get single club by ID
 * @access  Admin only
 */
router.get("/:clubId", validateParams(clubSchemas.clubId), getClubById);

/**
 * @route   PUT /api/web/clubs/:clubId
 * @desc    Update club
 * @access  Admin only
 */
router.put(
  "/:clubId",
  validateParams(clubSchemas.clubId),
  validateBody(clubSchemas.update),
  updateClub
);

/**
 * @route   DELETE /api/web/clubs/:clubId
 * @desc    Delete club (soft delete)
 * @access  Admin only
 */
router.delete("/:clubId", validateParams(clubSchemas.clubId), deleteClub);

/**
 * @route   GET /api/web/clubs/:clubId/stats
 * @desc    Get club statistics
 * @access  Admin only
 */
router.get("/:clubId/stats", validateParams(clubSchemas.clubId), getClubStats);

export default router;
