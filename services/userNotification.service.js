import Notification from "../schema/Notification.schema.js";
import User from "../schema/User.schema.js";
import { sendToMultipleDevices } from "../utils/fcm.util.js";

export const NOTIFICATION_PREF_KEYS = {
  CONNECTIONS: "connections",
  SOS: "sosReminders",
  EVENTS: "eventReminders",
  OPPORTUNITIES: "opportunities",
  CHALLENGES: "challengeReminders",
  COMMUNITY: "community",
};

const PUSH_BATCH_SIZE = 500;

const recipientAllowlist = () => {
  const raw = process.env.NOTIFY_ONLY_USER_IDS;
  if (!raw) return null;
  return new Set(raw.split(",").map((id) => id.trim()).filter(Boolean));
};

const allowsPush = (user, category) => {
  const key = NOTIFICATION_PREF_KEYS[category];
  if (!key) return true;
  return user.notificationPrefs?.[key] !== false;
};

const stringifyData = (data) =>
  Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, v == null ? "" : String(v)]));

export const notifyUsers = async ({ userIds, category = "GENERAL", type, title, body = "", data = {}, imageUrl, store = true }) => {
  try {
    const allowlist = recipientAllowlist();
    const ids = [...new Set((userIds || []).map(String))].filter((id) => !allowlist || allowlist.has(id));
    if (ids.length === 0) return { stored: 0, pushed: 0 };

    const users = await User.find({ _id: { $in: ids } }, "fcmTokens notificationPrefs").lean();
    if (users.length === 0) return { stored: 0, pushed: 0 };

    if (store) {
      await Notification.insertMany(
        users.map((u) => ({ user: u._id, category, type, title, body, data })),
        { ordered: false }
      );
    }

    const tokens = users
      .filter((u) => allowsPush(u, category))
      .flatMap((u) => (u.fcmTokens || []).map((t) => t.token).filter(Boolean));

    let pushed = 0;
    for (let i = 0; i < tokens.length; i += PUSH_BATCH_SIZE) {
      const result = await sendToMultipleDevices({
        tokens: tokens.slice(i, i + PUSH_BATCH_SIZE),
        title,
        body,
        imageUrl,
        data: stringifyData({ ...data, type, category }),
      });
      pushed += result.successCount || 0;
    }

    return { stored: users.length, pushed };
  } catch (error) {
    console.error(`[NOTIFY] ${type} failed:`, error.message);
    return { stored: 0, pushed: 0, error: error.message };
  }
};

export const notifyAllUsers = async ({ excludeUserIds = [], ...payload }) => {
  const exclude = excludeUserIds.map(String);
  const ids = await User.find({ _id: { $nin: exclude }, isDeleted: false }).distinct("_id");
  return notifyUsers({ ...payload, userIds: ids });
};

export default { notifyUsers, notifyAllUsers, NOTIFICATION_PREF_KEYS };
