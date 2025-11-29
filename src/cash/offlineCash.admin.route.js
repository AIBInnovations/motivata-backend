/**
 * @fileoverview Admin routes for offline cash management
 * @module routes/admin/offlineCash
 */

import express from "express";
import {
  createOfflineCash,
  getOfflineCashRecords,
  getOfflineCashById,
  deleteOfflineCash,
  getAllowedEvents,
  getCashEnrollments,
} from "./offlineCash.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import { offlineCashSchemas } from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/offline-cash
 * @desc    Create offline cash record
 * @access  Admin/Management Staff
 */
router.post(
  "/",
  validateBody(offlineCashSchemas.create),
  createOfflineCash
);

/**
 * @route   GET /api/web/offline-cash
 * @desc    Get all offline cash records
 * @access  Admin
 */
router.get(
  "/",
  validateQuery(offlineCashSchemas.list),
  getOfflineCashRecords
);

/**
 * @route   GET /api/web/offline-cash/allowed-events
 * @desc    Get events allowed for current admin (for dropdown)
 * @access  Admin/Management Staff
 */
router.get("/allowed-events", getAllowedEvents);

/**
 * @route   GET /api/web/offline-cash/:id
 * @desc    Get single offline cash record
 * @access  Admin
 */
router.get(
  "/:id",
  validateParams(offlineCashSchemas.id),
  getOfflineCashById
);

/**
 * @route   DELETE /api/web/offline-cash/:id
 * @desc    Delete offline cash record (soft delete)
 * @access  Admin/Super Admin
 */
router.delete(
  "/:id",
  validateParams(offlineCashSchemas.id),
  deleteOfflineCash
);

/**
 * @route   GET /api/web/offline-cash/event/:eventId/enrollments
 * @desc    Get cash enrollments for an event
 * @access  Admin
 */
router.get(
  "/event/:eventId/enrollments",
  validateParams(offlineCashSchemas.eventId),
  validateQuery(offlineCashSchemas.enrollmentList),
  getCashEnrollments
);

export default router;
