/**
 * @fileoverview FCM Token Management Routes (User)
 * @module Notification/fcm.user.route
 */

import express from "express";
import fcmController from "./fcm.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * All routes require user authentication
 */
router.use(authenticate);

/**
 * POST /api/app/notifications/fcm-token
 * Register or update FCM token for push notifications
 *
 * Body:
 * - token: string (FCM device token)
 * - device: 'android' | 'ios'
 */
router.post("/fcm-token", fcmController.registerFcmToken);

/**
 * DELETE /api/app/notifications/fcm-token
 * Remove FCM token (call on logout)
 *
 * Body:
 * - token: string (FCM device token to remove)
 */
router.delete("/fcm-token", fcmController.removeFcmToken);

/**
 * DELETE /api/app/notifications/fcm-token/all
 * Remove all FCM tokens (logout from all devices)
 */
router.delete("/fcm-token/all", fcmController.removeAllFcmTokens);

export default router;
