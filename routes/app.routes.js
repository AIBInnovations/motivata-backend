/**
 * @fileoverview App routes configuration for user-facing API endpoints.
 * @module routes/app
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import userAuthRoutes from "../src/Auth/user.auth.route.js";
import userEventRoutes from "../src/Event/user.event.route.js";
import userCouponRoutes from "../src/Enrollment/user.coupon.route.js";
import userPaymentRoutes from "../src/Enrollment/user.payment.route.js";
import userEnrollmentRoutes from "../src/Enrollment/user.enrollment.route.js";
import userTicketRoutes from "../src/Enrollment/user.ticket.route.js";
import userVoucherRoutes from "../src/Enrollment/voucher.user.route.js";
import userSessionRoutes from "../src/Session/session.user.route.js";
import userCalendlyRoutes from "../src/Calendly/calendly.public.route.js";
import userSOSRoutes from "../src/Quiz/sos.user.route.js";
import userChallengeRoutes from "../src/Challenge/challenge.user.route.js";
import userPollRoutes from "../src/Poll/poll.user.route.js";
import userConnectRoutes from "../src/Connect/connect.user.route.js";
import userNotificationRoutes from "../src/Notification/fcm.user.route.js";
import responseUtil from "../utils/response.util.js";
import services from "../src/Other/app/showDelete.js";
import publicAssetRoutes from "../src/Asset/asset.public.route.js";
import userStoryRoutes from "../src/Story/story.user.route.js";
import userMembershipRoutes from "../src/Membership/user.membership.route.js";
import seatArrangementUserRoutes from "../src/SeatArrangement/seatArrangement.user.route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, "../settings.json");

/** @type {express.Router} */
const router = express.Router();

/**
 * Register all web/user routes here
 * Base path: /api/app
 */

// Auth routes - /api/app/auth
router.use("/auth", userAuthRoutes);

// Event routes - /api/app/events
router.use("/events", userEventRoutes);

// Seat arrangement routes - /api/app/events/:eventId/seat-arrangement
router.use("/events", seatArrangementUserRoutes);

// Coupon routes - /api/app/coupons
router.use("/coupons", userCouponRoutes);

// Payment routes - /api/app/payments
router.use("/payments", userPaymentRoutes);

// Enrollment routes - /api/app/enrollments
router.use("/enrollments", userEnrollmentRoutes);

// Ticket routes - /api/app/tickets
router.use("/tickets", userTicketRoutes);

// Voucher routes - /api/app/vouchers
router.use("/vouchers", userVoucherRoutes);

// Session routes - /api/app/sessions
router.use("/sessions", userSessionRoutes);

// Calendly routes - /api/app/calendly (public slot fetching)
router.use("/calendly", userCalendlyRoutes);

// SOS routes - /api/app/sos
router.use("/sos", userSOSRoutes);

// Challenge routes - /api/app/challenges
router.use("/challenges", userChallengeRoutes);

// Poll routes - /api/app/polls
router.use("/polls", userPollRoutes);

// Connect routes - /api/app/connect (social feed feature)
router.use("/connect", userConnectRoutes);

// Asset routes - /api/app/assets
router.use("/assets", publicAssetRoutes);

// Story routes - /api/app/stories (view stories on Connect page)
router.use("/stories", userStoryRoutes);

// Notification routes - /api/app/notifications (FCM token management)
router.use("/notifications", userNotificationRoutes);

// Membership routes - /api/app/membership-plans and /api/app/memberships
router.use("/", userMembershipRoutes);

// Add more user routes here as needed
// Example:
// router.use("/profile", userProfileRoutes);
// router.use("/settings", userSettingsRoutes);

/**
 * DELETE /api/app/user/delete/:phonenumber
 * @description Endpoint to delete a user by phone number.
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Object} Success response
 */
router.delete("/user/delete/:phonenumber", (req, res) => {
  return responseUtil.success(res, "Success");
});

/**
 * Service routes - /api/app/service
 * @description Mounts service-related endpoints.
 * @see {@link module:Other/app/showDelete} for available endpoints:
 * - GET /api/app/service/show-delete
 */
router.use("/service", services);

/**
 * @route   POST /api/app/version/check
 * @desc    Check if app needs to be updated
 * @access  Public
 * @body    {string} version - Current app version (e.g., "1.0.0")
 * @returns {Object} Version check result with update requirements
 */
router.post("/version/check", (req, res) => {
  try {
    const { version } = req.body;

    if (!version) {
      return responseUtil.badRequest(res, "App version is required");
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const appVersion = settings.appVersion || {};

    const currentVersion = appVersion.currentVersion || "1.0.0";
    const minimumVersion = appVersion.minimumVersion || "1.0.0";
    const forceUpdate = appVersion.forceUpdate || false;
    const updateUrl = appVersion.updateUrl || "";

    // Compare versions (simple semver comparison)
    const compareVersions = (v1, v2) => {
      const parts1 = v1.split(".").map(Number);
      const parts2 = v2.split(".").map(Number);
      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
      }
      return 0;
    };

    const isUpdateAvailable = compareVersions(version, currentVersion) < 0;
    const isForceUpdateRequired = forceUpdate && compareVersions(version, minimumVersion) < 0;

    return responseUtil.success(res, "Version check successful", {
      currentVersion,
      minimumVersion,
      userVersion: version,
      isUpdateAvailable,
      isForceUpdateRequired,
      updateUrl,
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to check version", error.message);
  }
});

/**
 * @route   GET /api/app/version
 * @desc    Get current app version info (no auth required)
 * @access  Public
 * @returns {Object} Current version information
 */
router.get("/version", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const appVersion = settings.appVersion || {};

    return responseUtil.success(res, "Version info fetched", {
      currentVersion: appVersion.currentVersion || "1.0.0",
      minimumVersion: appVersion.minimumVersion || "1.0.0",
      forceUpdate: appVersion.forceUpdate || false,
      updateUrl: appVersion.updateUrl || "",
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch version", error.message);
  }
});

export default router;
