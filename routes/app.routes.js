import express from "express";
import userAuthRoutes from "../src/Auth/user.auth.route.js";
import userEventRoutes from "../src/Event/user.event.route.js";
import userCouponRoutes from "../src/Enrollment/user.coupon.route.js";
import userPaymentRoutes from "../src/Enrollment/user.payment.route.js";
import userEnrollmentRoutes from "../src/Enrollment/user.enrollment.route.js";
import userTicketRoutes from "../src/Enrollment/user.ticket.route.js";

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

// Add more user routes here as needed
// Example:
// router.use("/profile", userProfileRoutes);
// router.use("/settings", userSettingsRoutes);

export default router;
