import Notification from "../../schema/Notification.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";
import { NOTIFICATION_PREF_KEYS } from "../../services/userNotification.service.js";

const PREF_FIELDS = Object.values(NOTIFICATION_PREF_KEYS);

const formatPrefs = (prefs = {}) =>
  Object.fromEntries(PREF_FIELDS.map((key) => [key, prefs?.[key] !== false]));

export const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const query = { user: req.user.id };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return responseUtil.success(res, "Notifications fetched", {
      notifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch notifications", error.message);
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user.id, isRead: false });
    return responseUtil.success(res, "Unread count fetched", { unreadCount });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch unread count", error.message);
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return responseUtil.notFound(res, "Notification not found");
    return responseUtil.success(res, "Notification marked as read", { notification });
  } catch (error) {
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid notification ID");
    return responseUtil.internalError(res, "Failed to update notification", error.message);
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return responseUtil.success(res, "All notifications marked as read", {
      updated: result.modifiedCount || 0,
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to update notifications", error.message);
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notificationPrefs").lean();
    if (!user) return responseUtil.notFound(res, "User not found");
    return responseUtil.success(res, "Notification preferences fetched", {
      preferences: formatPrefs(user.notificationPrefs),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch preferences", error.message);
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const update = {};
    PREF_FIELDS.forEach((key) => {
      if (typeof req.body?.[key] === "boolean") update[`notificationPrefs.${key}`] = req.body[key];
    });
    if (Object.keys(update).length === 0) {
      return responseUtil.badRequest(res, "No preferences provided");
    }
    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true })
      .select("notificationPrefs")
      .lean();
    if (!user) return responseUtil.notFound(res, "User not found");
    return responseUtil.success(res, "Notification preferences updated", {
      preferences: formatPrefs(user.notificationPrefs),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to update preferences", error.message);
  }
};

export default {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
};
