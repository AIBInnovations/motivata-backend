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
  updateClubApprovalSetting,
  updateClubPostPermission,
  getAllJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
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

/**
 * @route   PUT /api/web/clubs/:clubId/approval-setting
 * @desc    Update club approval setting (requiresApproval)
 * @access  Admin only
 */
router.put(
  "/:clubId/approval-setting",
  validateParams(clubSchemas.clubId),
  validateBody(clubSchemas.updateApprovalSetting),
  updateClubApprovalSetting
);

/**
 * @route   PUT /api/web/clubs/:clubId/post-permission
 * @desc    Update club post permission setting
 * @access  Admin only
 */
router.put(
  "/:clubId/post-permission",
  validateParams(clubSchemas.clubId),
  validateBody(clubSchemas.updatePostPermission),
  updateClubPostPermission
);

/**
 * @route   GET /api/web/clubs/join-requests
 * @desc    Get all club join requests
 * @access  Admin only
 */
router.get(
  "/join-requests/all",
  validateQuery(clubSchemas.joinRequestAdminQuery),
  getAllJoinRequests
);

/**
 * @route   POST /api/web/clubs/join-requests/:requestId/approve
 * @desc    Approve a club join request
 * @access  Admin only
 */
router.post(
  "/join-requests/:requestId/approve",
  validateParams(clubSchemas.requestId),
  validateBody(clubSchemas.approveRequest),
  approveJoinRequest
);

/**
 * @route   POST /api/web/clubs/join-requests/:requestId/reject
 * @desc    Reject a club join request
 * @access  Admin only
 */
router.post(
  "/join-requests/:requestId/reject",
  validateParams(clubSchemas.requestId),
  validateBody(clubSchemas.rejectRequest),
  rejectJoinRequest
);

export default router;
