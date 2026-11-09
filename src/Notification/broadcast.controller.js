import mongoose from "mongoose";
import User from "../../schema/User.schema.js";
import UserMembership from "../../schema/UserMembership.schema.js";
import UserChallenge from "../Challenge/userChallenge.schema.js";
import Challenge from "../Challenge/challenge.schema.js";
import responseUtil from "../../utils/response.util.js";
import { notifyUsers } from "../../services/userNotification.service.js";

const TITLE_MAX = 65;
const BODY_MAX = 240;
const AUDIENCES = ["ALL", "MEMBERS", "CHALLENGE"];
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const recentSends = new Map();

const sendKey = ({ title, message, audience, challengeId }) =>
  [audience, challengeId || "", title.toLowerCase(), message.toLowerCase()].join("|");

const claimSend = (key) => {
  const now = Date.now();
  for (const [k, at] of recentSends) {
    if (now - at > DUPLICATE_WINDOW_MS) recentSends.delete(k);
  }
  if (recentSends.has(key)) return false;
  recentSends.set(key, now);
  return true;
};

const activeMemberUserIds = async () => {
  const now = new Date();
  const phones = await UserMembership.find({
    isDeleted: false,
    status: "ACTIVE",
    paymentStatus: "SUCCESS",
    startDate: { $lte: now },
    $or: [{ isLifetime: true }, { endDate: null }, { endDate: { $lte: new Date(1000) } }, { endDate: { $gt: now } }],
  }).distinct("phone");
  if (phones.length === 0) return [];
  const suffixes = [...new Set(phones.map((p) => String(p).replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10))];
  if (suffixes.length === 0) return [];
  return User.find({ isDeleted: false, phone: { $in: suffixes.map((s) => new RegExp(`${s}$`)) } }).distinct("_id");
};

const resolveAudience = async ({ audience, challengeId }) => {
  if (audience === "MEMBERS") return activeMemberUserIds();
  if (audience === "CHALLENGE") {
    return UserChallenge.find({ challengeId, status: "active" }).distinct("userId");
  }
  return User.find({ isDeleted: false }).distinct("_id");
};

const readPayload = (body) => {
  const title = String(body?.title || "").trim();
  const message = String(body?.body || "").trim();
  const audience = String(body?.audience || "ALL").toUpperCase();
  const challengeId = body?.challengeId ? String(body.challengeId) : null;

  if (!title) return { error: "Title is required" };
  if (title.length > TITLE_MAX) return { error: `Title cannot exceed ${TITLE_MAX} characters` };
  if (message.length > BODY_MAX) return { error: `Message cannot exceed ${BODY_MAX} characters` };
  if (!AUDIENCES.includes(audience)) return { error: "Audience must be ALL, MEMBERS or CHALLENGE" };
  if (audience === "CHALLENGE" && !mongoose.Types.ObjectId.isValid(challengeId || "")) {
    return { error: "Pick a challenge for this audience" };
  }
  return { title, message, audience, challengeId };
};

export const previewBroadcast = async (req, res) => {
  try {
    const payload = readPayload({ title: "preview", ...req.query });
    if (payload.error && payload.error !== "Title is required") return responseUtil.badRequest(res, payload.error);
    const userIds = await resolveAudience(payload);
    return responseUtil.success(res, "Audience counted", { recipients: userIds.length });
  } catch (error) {
    console.error("[BROADCAST] preview failed:", error.message);
    return responseUtil.internalError(res, "Failed to count the audience", error.message);
  }
};

export const sendBroadcast = async (req, res) => {
  try {
    const payload = readPayload(req.body);
    if (payload.error) return responseUtil.badRequest(res, payload.error);

    if (payload.audience === "CHALLENGE") {
      const exists = await Challenge.exists({ _id: payload.challengeId });
      if (!exists) return responseUtil.notFound(res, "Challenge not found");
    }

    const userIds = await resolveAudience(payload);
    if (userIds.length === 0) {
      return responseUtil.badRequest(res, "Nobody is in this audience yet");
    }

    const key = sendKey(payload);
    if (!claimSend(key)) {
      return responseUtil.conflict(
        res,
        "This exact notification was already sent to this audience in the last 10 minutes"
      );
    }

    const adminId = req.user?.id;
    notifyUsers({
      userIds,
      category: payload.audience === "CHALLENGE" ? "CHALLENGES" : "GENERAL",
      type: "ADMIN_BROADCAST",
      title: payload.title,
      body: payload.message,
      data: payload.challengeId ? { challengeId: payload.challengeId } : {},
    })
      .then((result) => {
        if (result.error) {
          recentSends.delete(key);
          console.error(`[BROADCAST] admin=${adminId} failed:`, result.error);
          return;
        }
        console.log(
          `[BROADCAST] admin=${adminId} audience=${payload.audience} recipients=${userIds.length} stored=${result.stored} pushed=${result.pushed}`
        );
      })
      .catch((err) => {
        recentSends.delete(key);
        console.error(`[BROADCAST] admin=${adminId} crashed:`, err?.message || err);
      });

    return res.status(202).json({
      status: 202,
      message: "Notification is being sent",
      data: { recipients: userIds.length },
      error: null,
    });
  } catch (error) {
    console.error("[BROADCAST] send failed:", error.message);
    return responseUtil.internalError(res, "Failed to send the notification", error.message);
  }
};

export default { previewBroadcast, sendBroadcast };
