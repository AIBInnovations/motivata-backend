/**
 * @fileoverview FCM Token Management Controller
 * @module Notification/fcm.controller
 */

import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Register or update FCM token for the authenticated user
 * POST /api/app/notifications/fcm-token
 */
export const registerFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, device } = req.body;

    if (!token || !device) {
      return responseUtil.badRequest(res, "Token and device type are required");
    }

    if (!["android", "ios"].includes(device)) {
      return responseUtil.badRequest(
        res,
        "Device must be 'android' or 'ios'"
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens.findIndex(
      (t) => t.token === token
    );

    if (existingTokenIndex !== -1) {
      // Update existing token
      user.fcmTokens[existingTokenIndex].device = device;
      user.fcmTokens[existingTokenIndex].updatedAt = new Date();
    } else {
      // Add new token (limit to 5 devices per user)
      if (user.fcmTokens.length >= 5) {
        // Remove oldest token
        user.fcmTokens.sort(
          (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)
        );
        user.fcmTokens.shift();
      }

      user.fcmTokens.push({
        token,
        device,
        updatedAt: new Date(),
      });
    }

    await user.save();

    console.log(`[FCM] Token registered for user ${userId} (${device})`);

    return responseUtil.success(res, "FCM token registered successfully", {
      tokenCount: user.fcmTokens.length,
    });
  } catch (error) {
    console.error("Register FCM token error:", error);
    return responseUtil.internalError(
      res,
      "Failed to register FCM token",
      error.message
    );
  }
};

/**
 * Remove FCM token (on logout or token invalidation)
 * DELETE /api/app/notifications/fcm-token
 */
export const removeFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return responseUtil.badRequest(res, "Token is required");
    }

    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // Remove the token
    const initialCount = user.fcmTokens.length;
    user.fcmTokens = user.fcmTokens.filter((t) => t.token !== token);

    if (user.fcmTokens.length === initialCount) {
      return responseUtil.notFound(res, "Token not found");
    }

    await user.save();

    console.log(`[FCM] Token removed for user ${userId}`);

    return responseUtil.success(res, "FCM token removed successfully", {
      tokenCount: user.fcmTokens.length,
    });
  } catch (error) {
    console.error("Remove FCM token error:", error);
    return responseUtil.internalError(
      res,
      "Failed to remove FCM token",
      error.message
    );
  }
};

/**
 * Remove all FCM tokens for user (on logout from all devices)
 * DELETE /api/app/notifications/fcm-token/all
 */
export const removeAllFcmTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    const removedCount = user.fcmTokens.length;
    user.fcmTokens = [];
    await user.save();

    console.log(`[FCM] All tokens removed for user ${userId} (${removedCount})`);

    return responseUtil.success(res, "All FCM tokens removed successfully", {
      removedCount,
    });
  } catch (error) {
    console.error("Remove all FCM tokens error:", error);
    return responseUtil.internalError(
      res,
      "Failed to remove FCM tokens",
      error.message
    );
  }
};

export default {
  registerFcmToken,
  removeFcmToken,
  removeAllFcmTokens,
};
