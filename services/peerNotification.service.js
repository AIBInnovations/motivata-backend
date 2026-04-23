/**
 * @fileoverview Peer notification service for challenges.
 * Sends an FCM push to every other active participant of a challenge
 * when a user marks one of its tasks complete.
 *
 * Designed to be fire-and-forget from the controller — errors are logged
 * and swallowed so that push failures never break the task-completion API.
 */

import Challenge from "../src/Challenge/challenge.schema.js";
import UserChallenge from "../src/Challenge/userChallenge.schema.js";
import User from "../schema/User.schema.js";
import { sendToMultipleDevices } from "../utils/fcm.util.js";

/**
 * Notify all peers of a challenge that {completingUser} just completed {task}.
 *
 * @param {Object} params
 * @param {Object} params.userChallenge - The completing user's UserChallenge doc (has challengeId).
 * @param {string} params.taskId - The task that was just completed.
 * @param {string} params.completingUserId - User who completed the task.
 */
export const notifyPeersOnTaskComplete = async ({
  userChallenge,
  taskId,
  completingUserId,
}) => {
  try {
    const challengeId = userChallenge.challengeId;

    const [completingUser, challenge, peers] = await Promise.all([
      User.findById(completingUserId, "name").lean(),
      Challenge.findById(challengeId, "title tasks imageUrl").lean(),
      UserChallenge.find(
        {
          challengeId,
          status: "active",
          userId: { $ne: completingUserId },
        },
        "userId"
      ).lean(),
    ]);

    if (!completingUser || !challenge || peers.length === 0) return;

    const task = (challenge.tasks || []).find(
      (t) => t._id.toString() === taskId.toString()
    );
    const taskTitle = task?.title || "a task";

    const peerIds = peers.map((p) => p.userId);
    const peerUsers = await User.find(
      { _id: { $in: peerIds } },
      "fcmTokens"
    ).lean();

    const tokens = peerUsers.flatMap((u) =>
      (u.fcmTokens || []).map((t) => t.token).filter(Boolean)
    );

    if (tokens.length === 0) return;

    await sendToMultipleDevices({
      tokens,
      title: "Challenge update!",
      body: `${completingUser.name} completed "${taskTitle}"`,
      imageUrl: challenge.imageUrl || undefined,
      data: {
        screen: "ChallengeProgress",
        challengeId: String(challengeId),
        type: "PEER_TASK_COMPLETED",
        byUserId: String(completingUserId),
        byUserName: completingUser.name,
      },
    });
  } catch (err) {
    console.error("[PEER-NOTIFY] Failed to notify peers:", err.message);
  }
};
