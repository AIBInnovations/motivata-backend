import express from "express";
import adminAuthRoutes from "../src/Auth/admin.auth.route.js";
import adminEventRoutes from "../src/Event/admin.event.route.js";
import adminCouponRoutes from "../src/Enrollment/admin.coupon.route.js";
import adminPaymentRoutes from "../src/Enrollment/admin.payment.route.js";
import adminEnrollmentRoutes from "../src/Enrollment/admin.enrollment.route.js";
import adminTicketRoutes from "../src/Enrollment/admin.ticket.route.js";
import adminVoucherRoutes from "../src/Enrollment/voucher.admin.route.js";
import adminSessionRoutes from "../src/Session/session.admin.route.js";
import adminSOSRoutes from "../src/Quiz/sos.admin.route.js";
import adminChallengeRoutes from "../src/Challenge/challenge.admin.route.js";
import adminPollRoutes from "../src/Poll/poll.admin.route.js";
import razorpayRoutes from "../src/razorpay/razorpay.route.js";
import cashRoutes from "../src/cash/cash.route.js";
import offlineCashRoutes from "../src/cash/offlineCash.admin.route.js";
import adminSettingsRoutes from "../src/Other/admin/settings.route.js";
import analyticsRoutes from "../src/Analytics/analytics.route.js";
import adminAssetRoutes from "../src/Asset/asset.admin.route.js";

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

// Voucher routes - /api/web/vouchers
router.use("/vouchers", adminVoucherRoutes);

// Session routes - /api/web/sessions
router.use("/sessions", adminSessionRoutes);

// SOS routes - /api/web/sos
router.use("/sos", adminSOSRoutes);

// Challenge routes - /api/web/challenges
router.use("/challenges", adminChallengeRoutes);

// Poll routes - /api/web/polls
router.use("/polls", adminPollRoutes);

// Razorpay routes - /api/web/razorpay
router.use("/razorpay", razorpayRoutes);

// Cash payment routes - /api/web/cash
router.use("/cash", cashRoutes);

// Offline cash routes - /api/web/offline-cash
router.use("/offline-cash", offlineCashRoutes);

// Settings routes - /api/web/settings
router.use("/settings", adminSettingsRoutes);

// Analytics routes - /api/web/analytics
router.use("/analytics", analyticsRoutes);

// Asset routes - /api/web/assets
router.use("/assets", adminAssetRoutes);

// Add more admin routes here as needed
// Example:
// router.use("/dashboard", adminDashboardRoutes);
// router.use("/reports", adminReportsRoutes);

// src/Account/deleteAccount

router.post("/account/delete-account", (req, res) => {
  // You said it should do nothing — just return 200
  res
    .status(200)
    .json({ success: true, message: "Account deletion request accepted." });
});

router.get("/delete-account", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Delete Account</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #ffffff;
            color: #191919;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            width: 100%;
            max-width: 400px;
          }
          h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .subtitle {
            color: #6b6b6b;
            font-size: 14px;
            margin-bottom: 32px;
          }
          form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          label {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
            display: block;
          }
          input[type="email"] {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            outline: none;
            transition: border-color 0.15s ease;
          }
          input[type="email"]:focus {
            border-color: #191919;
          }
          input[type="email"]::placeholder {
            color: #a0a0a0;
          }
          button {
            width: 100%;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 500;
            background: #191919;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.15s ease;
            margin-top: 8px;
          }
          button:hover {
            background: #333333;
          }
          .warning {
            font-size: 12px;
            color: #6b6b6b;
            margin-top: 16px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Delete Account</h1>
          <p class="subtitle">This action cannot be undone.</p>
          <form method="POST" action="/api/web/account/delete-account">
            <div>
              <label for="email">Email address</label>
              <input type="email" id="email" name="email" placeholder="you@example.com" required />
            </div>
            <button type="submit">Delete Account</button>
          </form>
          <p class="warning">By clicking "Delete Account", you confirm that you want to permanently delete your account and all associated data.</p>
        </div>
      </body>
    </html>
  `;
  res.send(html);
});

export default router;
