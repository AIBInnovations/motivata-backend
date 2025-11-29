/**
 * @fileoverview User routes for offline cash ticket redemption
 * @module routes/user/offlineCash
 */

import express from "express";
import {
  validateRedemptionLink,
  redeemTickets,
  scanCashTicket,
} from "./offlineCash.controller.js";
import {
  validateBody,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import { offlineCashSchemas } from "../../middleware/validation.middleware.js";

const router = express.Router();

/**
 * @route   GET /api/app/tickets/redeem
 * @desc    Validate redemption link and get form data
 * @access  Public
 */
router.get(
  "/redeem",
  validateQuery(offlineCashSchemas.validateLink),
  validateRedemptionLink
);

/**
 * @route   POST /api/app/tickets/redeem
 * @desc    Submit redemption form and create enrollments
 * @access  Public
 */
router.post(
  "/redeem",
  validateBody(offlineCashSchemas.redeem),
  redeemTickets
);

/**
 * @route   GET /api/app/tickets/cash/qr-scan
 * @desc    Scan cash ticket QR code
 * @access  Public
 */
router.get(
  "/cash/qr-scan",
  validateQuery(offlineCashSchemas.scanTicket),
  scanCashTicket
);

export default router;
