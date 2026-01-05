/**
 * @fileoverview User club routes for public club operations
 * @module routes/club/user
 */

import express from "express";
import {
  getAllClubs,
  getClubById,
  joinClub,
  leaveClub,
  getClubFeed,
  getClubMembers,
  getMyClubs,
} from "./club.user.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
  clubSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * @route   GET /api/app/connect/clubs
 * @desc    Get all clubs (public, with join status if authenticated)
 * @access  Public (optional auth)
 */
router.get("/", optionalAuth, validateQuery(clubSchemas.listUser), getAllClubs);

/**
 * @route   GET /api/app/connect/clubs/my-clubs
 * @desc    Get clubs the authenticated user has joined
 * @access  Private
 */
router.get(
  "/my-clubs",
  authenticate,
  validateQuery(clubSchemas.paginationQuery),
  getMyClubs
);

/**
 * @route   GET /api/app/connect/clubs/:clubId
 * @desc    Get single club details
 * @access  Public (optional auth)
 */
router.get(
  "/:clubId",
  optionalAuth,
  validateParams(clubSchemas.clubId),
  getClubById
);

/**
 * @route   POST /api/app/connect/clubs/:clubId/join
 * @desc    Join a club
 * @access  Private
 */
router.post(
  "/:clubId/join",
  authenticate,
  validateParams(clubSchemas.clubId),
  joinClub
);

/**
 * @route   DELETE /api/app/connect/clubs/:clubId/join
 * @desc    Leave a club
 * @access  Private
 */
router.delete(
  "/:clubId/join",
  authenticate,
  validateParams(clubSchemas.clubId),
  leaveClub
);

/**
 * @route   GET /api/app/connect/clubs/:clubId/feed
 * @desc    Get posts in a club
 * @access  Private (must be a member)
 */
router.get(
  "/:clubId/feed",
  authenticate,
  validateParams(clubSchemas.clubId),
  validateQuery(clubSchemas.feedQuery),
  getClubFeed
);

/**
 * @route   GET /api/app/connect/clubs/:clubId/members
 * @desc    Get club members
 * @access  Public (optional auth for follow status)
 */
router.get(
  "/:clubId/members",
  optionalAuth,
  validateParams(clubSchemas.clubId),
  validateQuery(clubSchemas.paginationQuery),
  getClubMembers
);

export default router;
