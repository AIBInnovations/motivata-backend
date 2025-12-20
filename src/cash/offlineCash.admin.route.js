/**
 * @fileoverview Admin routes for offline cash management
 * @module routes/admin/offlineCash
 */

import express from "express";
import multer from "multer";
import {
  createOfflineCash,
  getOfflineCashRecords,
  getOfflineCashById,
  deleteOfflineCash,
  getAllowedEvents,
  getCashEnrollments,
} from "./offlineCash.controller.js";
import {
  createDirectTicket,
  createDirectTicketBulk,
} from "./directTicket.controller.js";
import { directTicketSchemas } from "./directTicket.validation.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import { offlineCashSchemas } from "../../middleware/validation.middleware.js";

const router = express.Router();

// Configure multer for Excel file upload (direct ticket bulk)
const storage = multer.memoryStorage();
const excelUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type: ${file.mimetype}. Only Excel (.xlsx, .xls) and CSV are allowed.`),
        false
      );
    }
  },
});

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

/**
 * @route   POST /api/web/offline-cash/direct-ticket
 * @desc    Create direct ticket for single attendee (bypasses redemption flow)
 * @access  Admin/Management Staff
 * @body    {eventId, phone, name, priceCharged?, notes?}
 */
router.post(
  "/direct-ticket",
  validateBody(directTicketSchemas.single),
  createDirectTicket
);

/**
 * @route   POST /api/web/offline-cash/direct-ticket-bulk
 * @desc    Create direct tickets from Excel file (bypasses redemption flow)
 * @access  Admin/Management Staff
 * @body    {eventId, priceCharged?, notes?} + file (Excel with phone, name columns)
 * @returns Success summary + rejection Excel file (base64) for failed entries
 */
router.post(
  "/direct-ticket-bulk",
  excelUpload.single("file"),
  validateBody(directTicketSchemas.bulk),
  createDirectTicketBulk
);

export default router;
