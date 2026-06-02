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
import Connect from "../schema/Connect.schema.js";
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

/**
 * Nudge the requesting user's connections (people they follow) who are taking
 * the same challenge, asking them to update their progress.
 *
 * @param {Object} params
 * @param {string} params.challengeId - The challenge to nudge about.
 * @param {string} params.requesterId - User sending the nudge.
 * @returns {Promise<{ notified: number }>} How many connections were reached.
 */
export const notifyConnectionsToUpdate = async ({ challengeId, requesterId }) => {
  const [requester, challenge, followingIds] = await Promise.all([
    User.findById(requesterId, "name").lean(),
    Challenge.findById(challengeId, "title imageUrl").lean(),
    Connect.find({ follower: requesterId, isDeleted: false }).distinct("following"),
  ]);

  if (!challenge) {
    throw { status: 404, message: "Challenge not found" };
  }
  if (!followingIds.length) {
    return { notified: 0 };
  }

  // Connections who are actively taking this challenge
  const connectionChallenges = await UserChallenge.find(
    {
      challengeId,
      status: "active",
      userId: { $in: followingIds },
    },
    "userId"
  ).lean();

  if (!connectionChallenges.length) {
    return { notified: 0 };
  }

  const recipientIds = connectionChallenges.map((uc) => uc.userId);
  const recipients = await User.find(
    { _id: { $in: recipientIds } },
    "fcmTokens"
  ).lean();

  const tokens = recipients.flatMap((u) =>
    (u.fcmTokens || []).map((t) => t.token).filter(Boolean)
  );

  if (!tokens.length) {
    return { notified: recipientIds.length };
  }

  await sendToMultipleDevices({
    tokens,
    title: "Challenge update!",
    body: `${requester?.name || "A connection"} completed today's challenge, did you? Mark your progress`,
    imageUrl: challenge.imageUrl || undefined,
    data: {
      screen: "ChallengeProgress",
      challengeId: String(challengeId),
      type: "CONNECTION_NUDGE",
      byUserId: String(requesterId),
      byUserName: requester?.name || "",
    },
  });

  return { notified: recipientIds.length };
};

/**
 * Notify the referrer that someone joined a challenge they shared.
 * Fire-and-forget — failures are logged and swallowed.
 *
 * @param {Object} params
 * @param {string} params.challengeId - The challenge that was joined.
 * @param {string} params.joinerId - User who just joined.
 * @param {string} params.referrerId - User who shared the invite.
 */
export const notifyReferrerOnJoin = async ({ challengeId, joinerId, referrerId }) => {
  try {
    if (!referrerId || String(referrerId) === String(joinerId)) return;

    const [joiner, referrer, challenge] = await Promise.all([
      User.findById(joinerId, "name").lean(),
      User.findById(referrerId, "fcmTokens").lean(),
      Challenge.findById(challengeId, "title imageUrl").lean(),
    ]);

    if (!joiner || !referrer || !challenge) return;

    const tokens = (referrer.fcmTokens || [])
      .map((t) => t.token)
      .filter(Boolean);

    if (tokens.length === 0) return;

    await sendToMultipleDevices({
      tokens,
      title: "Your invite worked! 🎉",
      body: `${joiner.name} joined "${challenge.title}" that you shared`,
      imageUrl: challenge.imageUrl || undefined,
      data: {
        screen: "ChallengeProgress",
        challengeId: String(challengeId),
        type: "REFERRAL_JOIN",
        byUserId: String(joinerId),
        byUserName: joiner.name,
      },
    });
  } catch (err) {
    console.error("[REFERRAL-NOTIFY] Failed to notify referrer:", err.message);
  }
};
