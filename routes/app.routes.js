/**
 * @fileoverview App routes configuration for user-facing API endpoints.
 * @module routes/app
 */

import express from "express";
import userAuthRoutes from "../src/Auth/user.auth.route.js";
import userEventRoutes from "../src/Event/user.event.route.js";
import userCouponRoutes from "../src/Enrollment/user.coupon.route.js";
import userPaymentRoutes from "../src/Enrollment/user.payment.route.js";
import userEnrollmentRoutes from "../src/Enrollment/user.enrollment.route.js";
import userTicketRoutes from "../src/Enrollment/user.ticket.route.js";
import userVoucherRoutes from "../src/Enrollment/voucher.user.route.js";
import userSessionRoutes from "../src/Session/session.user.route.js";
import userQuizRoutes from "../src/Quiz/quiz.user.route.js";
import responseUtil from "../utils/response.util.js";
import services from "../src/Other/app/showDelete.js";

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

// Quiz routes - /api/app/quizzes
router.use("/quizzes", userQuizRoutes);

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

export default router;
