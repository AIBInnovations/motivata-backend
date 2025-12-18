/**
 * @fileoverview FCM (Firebase Cloud Messaging) utility for push notifications
 * @module utils/fcm
 */

import { firebaseAdmin } from "../config/firebase.config.js";
import CommunicationLog from "../schema/CommunicationLog.schema.js";
import User from "../schema/User.schema.js";
import EventEnrollment from "../schema/EventEnrollment.schema.js";
import CashEventEnrollment from "../schema/CashEventEnrollment.schema.js";

/**
 * Send push notification to a single device
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.token - FCM device token
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} [params.data] - Custom data payload for navigation
 * @param {string} [params.userId] - User ID for logging
 * @param {string} [params.eventId] - Event ID for logging
 *
 * @returns {Promise<Object>} Send result
 */
export const sendToDevice = async ({
  token,
  title,
  body,
  data = {},
  userId,
  eventId,
}) => {
  let communicationLog = null;

  try {
    console.log(`[FCM] ========== SENDING NOTIFICATION ==========`);
    console.log(`[FCM] Token: ${token.substring(0, 20)}...`);
    console.log(`[FCM] Title: ${title}`);
    console.log(`[FCM] Body: ${body}`);

    // Create communication log entry (PENDING status)
    communicationLog = new CommunicationLog({
      type: "NOTIFICATION",
      category: "EVENT_REMINDER",
      recipient: token.substring(0, 50),
      status: "PENDING",
      userId: userId || null,
      eventId: eventId || null,
      metadata: {
        title,
        body,
        data,
      },
    });
    await communicationLog.save();

    // Build the message
    const message = {
      token,
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().send(message);

    console.log(`[FCM] ✓ Message sent successfully!`);
    console.log(`[FCM]   - Message ID: ${response}`);
    console.log(`[FCM] ========== NOTIFICATION SENT ==========`);

    // Update communication log to SUCCESS
    if (communicationLog) {
      communicationLog.status = "SUCCESS";
      communicationLog.messageId = response;
      await communicationLog.save();
    }

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    console.error(`[FCM] ✗ FAILED to send notification`);
    console.error(`[FCM] Error: ${error.message}`);

    // Update communication log to FAILED
    if (communicationLog) {
      try {
        communicationLog.status = "FAILED";
        communicationLog.errorMessage = error.message;
        await communicationLog.save();
      } catch (logError) {
        console.error(`[FCM] Failed to update log:`, logError.message);
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send push notification to multiple devices
 *
 * @param {Object} params - Notification parameters
 * @param {string[]} params.tokens - Array of FCM device tokens
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} [params.data] - Custom data payload for navigation
 * @param {string} [params.eventId] - Event ID for logging
 *
 * @returns {Promise<Object>} Send results with success and failure counts
 */
export const sendToMultipleDevices = async ({
  tokens,
  title,
  body,
  data = {},
  eventId,
}) => {
  if (!tokens || tokens.length === 0) {
    console.log(`[FCM] No tokens provided, skipping notification`);
    return { success: true, successCount: 0, failureCount: 0 };
  }

  console.log(`[FCM] ========== SENDING BULK NOTIFICATION ==========`);
  console.log(`[FCM] Recipients: ${tokens.length} devices`);
  console.log(`[FCM] Title: ${title}`);
  console.log(`[FCM] Body: ${body}`);

  try {
    // Build the multicast message
    const message = {
      tokens,
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);

    console.log(`[FCM] ✓ Bulk send complete!`);
    console.log(`[FCM]   - Success: ${response.successCount}`);
    console.log(`[FCM]   - Failures: ${response.failureCount}`);

    // Log failures for debugging
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM]   ✗ Token ${idx}: ${resp.error?.message}`);
        }
      });
    }

    // Create single communication log for bulk send
    const communicationLog = new CommunicationLog({
      type: "NOTIFICATION",
      category: "EVENT_REMINDER",
      recipient: `bulk:${tokens.length}`,
      status: response.failureCount === 0 ? "SUCCESS" : "PENDING",
      eventId: eventId || null,
      metadata: {
        title,
        body,
        data,
        totalRecipients: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      },
    });
    await communicationLog.save();

    console.log(`[FCM] ========== BULK NOTIFICATION COMPLETE ==========`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    console.error(`[FCM] ✗ CRITICAL ERROR in bulk send`);
    console.error(`[FCM] Error: ${error.message}`);

    return {
      success: false,
      error: error.message,
      successCount: 0,
      failureCount: tokens.length,
    };
  }
};

/**
 * Get FCM tokens for all users enrolled in an event
 * Checks both EventEnrollment and CashEventEnrollment
 *
 * @param {string} eventId - Event ID to get enrolled users for
 * @returns {Promise<string[]>} Array of FCM tokens
 */
export const getEnrolledUserTokens = async (eventId) => {
  try {
    console.log(`[FCM] Fetching tokens for event: ${eventId}`);

    // Get user IDs from EventEnrollment
    const eventEnrollments = await EventEnrollment.find({
      eventId,
    }).select("userId tickets");

    // Get phones from EventEnrollment tickets Map
    const enrollmentPhones = [];
    eventEnrollments.forEach((enrollment) => {
      if (enrollment.tickets) {
        for (const [phone, ticketData] of enrollment.tickets.entries()) {
          if (ticketData.status === "ACTIVE") {
            enrollmentPhones.push(phone);
          }
        }
      }
    });

    // Get user IDs from CashEventEnrollment
    const cashEnrollments = await CashEventEnrollment.find({
      eventId,
      status: "ACTIVE",
    }).select("userId phone");

    // Collect all user IDs
    const userIds = new Set();
    eventEnrollments.forEach((e) => {
      if (e.userId) userIds.add(e.userId.toString());
    });
    cashEnrollments.forEach((e) => {
      if (e.userId) userIds.add(e.userId.toString());
    });

    // Also find users by phone numbers
    const allPhones = [
      ...enrollmentPhones,
      ...cashEnrollments.map((e) => e.phone),
    ];

    // Normalize phones to 10 digits
    const normalizedPhones = allPhones.map((p) => {
      const cleaned = p.replace(/\D/g, "");
      return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
    });

    // Find users by phone
    const usersByPhone = await User.find({
      phone: { $in: normalizedPhones },
      isDeleted: false,
    }).select("_id");

    usersByPhone.forEach((u) => userIds.add(u._id.toString()));

    console.log(`[FCM] Found ${userIds.size} unique enrolled users`);

    // Get FCM tokens for all users
    const users = await User.find({
      _id: { $in: Array.from(userIds) },
      isDeleted: false,
      "fcmTokens.0": { $exists: true },
    }).select("fcmTokens");

    // Extract all tokens
    const tokens = [];
    users.forEach((user) => {
      user.fcmTokens.forEach((tokenData) => {
        if (tokenData.token) {
          tokens.push(tokenData.token);
        }
      });
    });

    console.log(`[FCM] Collected ${tokens.length} FCM tokens`);

    return tokens;
  } catch (error) {
    console.error(`[FCM] Error fetching enrolled user tokens:`, error.message);
    return [];
  }
};

/**
 * Send poll notification to all enrolled users of an event
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.eventId - Event ID
 * @param {string} params.pollId - Poll ID
 * @param {string} params.eventName - Event name for notification
 * @param {string} params.action - 'created' | 'updated'
 *
 * @returns {Promise<Object>} Send result
 */
export const sendPollNotification = async ({
  eventId,
  pollId,
  eventName,
  action = "created",
}) => {
  try {
    const tokens = await getEnrolledUserTokens(eventId);

    if (tokens.length === 0) {
      console.log(`[FCM] No tokens found for event ${eventId}, skipping`);
      return { success: true, message: "No enrolled users with FCM tokens" };
    }

    const title =
      action === "created" ? "New Poll Available!" : "Poll Updated!";
    const body =
      action === "created"
        ? `A new poll is available for "${eventName}". Share your feedback now!`
        : `The poll for "${eventName}" has been updated. Check it out!`;

    const result = await sendToMultipleDevices({
      tokens,
      title,
      body,
      data: {
        type: "POLL",
        eventId: eventId.toString(),
        pollId: pollId.toString(),
        screen: "PollScreen",
      },
      eventId,
    });

    return result;
  } catch (error) {
    console.error(`[FCM] Error sending poll notification:`, error.message);
    return { success: false, error: error.message };
  }
};

export default {
  sendToDevice,
  sendToMultipleDevices,
  getEnrolledUserTokens,
  sendPollNotification,
};
