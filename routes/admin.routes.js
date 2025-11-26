import express from "express";
import adminAuthRoutes from "../src/Auth/admin.auth.route.js";
import adminEventRoutes from "../src/Event/admin.event.route.js";
import adminCouponRoutes from "../src/Enrollment/admin.coupon.route.js";
import adminPaymentRoutes from "../src/Enrollment/admin.payment.route.js";
import adminEnrollmentRoutes from "../src/Enrollment/admin.enrollment.route.js";
import adminTicketRoutes from "../src/Enrollment/admin.ticket.route.js";
import razorpayRoutes from "../src/razorpay/razorpay.route.js";
import cashRoutes from "../src/cash/cash.route.js";

const router = express.Router();

/**
 * Register all admin routes here
 * Base path: /api/web
 */

// Auth routes - /api/web/auth
router.use("/auth", adminAuthRoutes);

// Event routes - /api/web/events
router.use("/events", adminEventRoutes);

// Coupon routes - /api/web/coupons
router.use("/coupons", adminCouponRoutes);

// Payment routes - /api/web/payments
router.use("/payments", adminPaymentRoutes);

// Enrollment routes - /api/web/enrollments
router.use("/enrollments", adminEnrollmentRoutes);

// Ticket routes - /api/web/tickets
router.use("/tickets", adminTicketRoutes);

// Razorpay routes - /api/web/razorpay
router.use("/razorpay", razorpayRoutes);

// Cash payment routes - /api/web/cash
router.use("/cash", cashRoutes);

// Add more admin routes here as needed
// Example:
// router.use("/dashboard", adminDashboardRoutes);
// router.use("/reports", adminReportsRoutes);

export default router;
