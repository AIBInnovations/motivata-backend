/**
 * @fileoverview Analytics routes for admin dashboard
 * @module routes/analytics
 */

import express from "express";
import {
  getDashboardStats,
  getCommunicationLogs,
} from "./analytics.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * All routes require admin authentication
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route GET /api/web/analytics/dashboard
 * @desc Get comprehensive dashboard statistics
 * @access Admin
 *
 * @returns {Object} Comprehensive analytics including:
 * - Communication stats (email, WhatsApp) with time breakdown
 * - User and admin statistics
 * - Event enrollment statistics
 * - Cash ticket statistics
 * - Payment and revenue statistics
 * - Event-wise performance
 * - Admin-wise performance
 * - Coupon and voucher usage
 * - Recent activity summary
 *
 * Time breakdowns available for:
 * - Lifetime
 * - This month
 * - Last month
 * - Last 3 months
 * - Last 6 months
 * - Last 12 months
 */
router.get("/dashboard", getDashboardStats);

/**
 * @route GET /api/web/analytics/communications
 * @desc Get communication logs with filtering
 * @access Admin
 *
 * @query {string} [type] - Communication type (EMAIL, WHATSAPP, SMS)
 * @query {string} [category] - Category (TICKET, VOUCHER, etc.)
 * @query {string} [status] - Status (SUCCESS, FAILED, PENDING)
 * @query {string} [startDate] - Start date filter (ISO format)
 * @query {string} [endDate] - End date filter (ISO format)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=50] - Items per page
 *
 * @returns {Object} Paginated communication logs
 */
router.get("/communications", getCommunicationLogs);

export default router;
