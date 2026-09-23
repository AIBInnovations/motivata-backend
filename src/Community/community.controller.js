import WeeklyUpdate, { WEEKLY_UPDATE_TAGS, WEEKLY_UPDATE_MAX_CHARS } from "../../schema/WeeklyUpdate.schema.js";
import HelpRequest, { HELP_REQUEST_TAGS } from "../../schema/HelpRequest.schema.js";
import User from "../../schema/User.schema.js";
import Connect from "../../schema/Connect.schema.js";
import responseUtil from "../../utils/response.util.js";
import { getAccessTier } from "../../middleware/membership.middleware.js";
import { notifyUsers, notifyAllUsers } from "../../services/userNotification.service.js";

const IST_OFFSET_MS = 330 * 60 * 1000;
const LINK_PATTERN = /^https?:\/\/\S+$/i;

export const currentWeekKey = (date = new Date()) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = (ist.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
};

const nextWeekStart = (weekKey) => {
  const monday = new Date(`${weekKey}T00:00:00.000Z`);
  return new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
};

const pageParams = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const paginationOf = (page, limit, totalCount) => {
  const totalPages = Math.ceil(totalCount / limit);
  return { currentPage: page, totalPages, totalCount, limit, hasNextPage: page < totalPages };
};

const requireDoerOrMember = async (req, res) => {
  const tier = await getAccessTier(req.user);
  if (tier === "NONE") {
    responseUtil.forbidden(res, "Only Doers and Members can post here. Become a Doer to join in.");
    return null;
  }
  return tier;
};

const connectionIdsOf = async (userId) => {
  const [a, b] = await Promise.all([
    Connect.find({ follower: userId, isDeleted: false }).distinct("following"),
    Connect.find({ following: userId, isDeleted: false }).distinct("follower"),
  ]);
  return [...new Set([...a, ...b].map(String))];
};

const formatUpdate = (u, viewerId) => ({
  id: u._id,
  author: { id: u.user?._id || u.user, name: u.user?.name || u.authorName },
  tag: u.tag,
  text: u.text,
  linkUrl: u.linkUrl || "",
  weekKey: u.weekKey,
  isOwn: viewerId ? String(u.user?._id || u.user) === String(viewerId) : false,
  createdAt: u.createdAt,
});

const formatHelp = (h, viewerId) => ({
  id: h._id,
  author: { id: h.user?._id || h.user, name: h.user?.name || h.authorName },
  tag: h.tag,
  title: h.title,
  description: h.description,
  deadline: h.deadline,
  contactName: h.contactName,
  contactPhone: h.contactPhone,
  contactEmail: h.contactEmail,
  city: h.city,
  status: h.status,
  isOwn: viewerId ? String(h.user?._id || h.user) === String(viewerId) : false,
  createdAt: h.createdAt,
});

export const getCommunityMeta = async (req, res) => {
  try {
    const tier = await getAccessTier(req.user);
    const weekKey = currentWeekKey();
    const postedThisWeek = req.user?.id
      ? await WeeklyUpdate.exists({ user: req.user.id, weekKey })
      : null;
    return responseUtil.success(res, "Community info fetched", {
      weeklyUpdateTags: WEEKLY_UPDATE_TAGS,
      helpTags: HELP_REQUEST_TAGS,
      weeklyUpdateMaxChars: WEEKLY_UPDATE_MAX_CHARS,
      canPost: tier !== "NONE",
      weekKey,
      postedThisWeek: !!postedThisWeek,
      nextWeeklyUpdateAt: nextWeekStart(weekKey),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch community info", error.message);
  }
};

export const listWeeklyUpdates = async (req, res) => {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const query = {};
    if (WEEKLY_UPDATE_TAGS.includes(req.query.tag)) query.tag = req.query.tag;
    if (req.query.mine === "true" && req.user?.id) query.user = req.user.id;

    const [updates, totalCount] = await Promise.all([
      WeeklyUpdate.find(query).populate("user", "name").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WeeklyUpdate.countDocuments({ ...query, isDeleted: false }),
    ]);

    return responseUtil.success(res, "Weekly updates fetched", {
      updates: updates.map((u) => formatUpdate(u, req.user?.id)),
      pagination: paginationOf(page, limit, totalCount),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch weekly updates", error.message);
  }
};

export const createWeeklyUpdate = async (req, res) => {
  try {
    if (!(await requireDoerOrMember(req, res))) return;

    const tag = String(req.body?.tag || "").toUpperCase();
    const text = String(req.body?.text || "").trim();
    const linkUrl = String(req.body?.linkUrl || "").trim();

    if (!WEEKLY_UPDATE_TAGS.includes(tag)) return responseUtil.badRequest(res, "Choose a tag for your update");
    if (!text) return responseUtil.badRequest(res, "Write something to share");
    if (text.length > WEEKLY_UPDATE_MAX_CHARS) {
      return responseUtil.badRequest(res, `Keep your update under ${WEEKLY_UPDATE_MAX_CHARS} characters`);
    }
    if (linkUrl && !LINK_PATTERN.test(linkUrl)) {
      return responseUtil.badRequest(res, "Link must start with http:// or https://");
    }

    const weekKey = currentWeekKey();
    const already = await WeeklyUpdate.exists({ user: req.user.id, weekKey });
    if (already) {
      return responseUtil.conflict(res, "You have already shared your update this week. You can share again next Monday.");
    }

    const user = await User.findById(req.user.id).select("name").lean();
    const update = await WeeklyUpdate.create({
      user: req.user.id,
      authorName: user?.name || "Member",
      tag,
      text,
      linkUrl,
      weekKey,
    });

    connectionIdsOf(req.user.id)
      .then((ids) =>
        notifyUsers({
          userIds: ids,
          category: "COMMUNITY",
          type: "WEEKLY_UPDATE",
          title: `${user?.name || "A connection"} shared a weekly update`,
          body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
          data: { screen: "Community", tab: "updates", updateId: String(update._id) },
        })
      )
      .catch((err) => console.error("[COMMUNITY] Weekly update notify failed:", err.message));

    return responseUtil.created(res, "Weekly update shared", {
      update: formatUpdate({ ...update.toObject(), user: { _id: req.user.id, name: user?.name } }, req.user.id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return responseUtil.conflict(res, "You have already shared your update this week. You can share again next Monday.");
    }
    if (error.name === "ValidationError") return responseUtil.badRequest(res, error.message);
    return responseUtil.internalError(res, "Failed to share update", error.message);
  }
};

export const deleteWeeklyUpdate = async (req, res) => {
  try {
    const update = await WeeklyUpdate.findById(req.params.id);
    if (!update) return responseUtil.notFound(res, "Update not found");
    const isAdmin = req.user.userType === "admin";
    if (!isAdmin && String(update.user) !== String(req.user.id)) {
      return responseUtil.forbidden(res, "You can only delete your own update");
    }
    update.isDeleted = true;
    update.deletedAt = new Date();
    await update.save();
    return responseUtil.success(res, "Update deleted");
  } catch (error) {
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid update ID");
    return responseUtil.internalError(res, "Failed to delete update", error.message);
  }
};

export const listHelpRequests = async (req, res) => {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const query = {};
    if (HELP_REQUEST_TAGS.includes(req.query.tag)) query.tag = req.query.tag;
    if (req.query.status === "OPEN" || req.query.status === "RESOLVED") query.status = req.query.status;
    if (req.query.mine === "true" && req.user?.id) query.user = req.user.id;

    const [requests, totalCount] = await Promise.all([
      HelpRequest.find(query)
        .populate("user", "name")
        .sort({ status: 1, tag: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HelpRequest.countDocuments({ ...query, isDeleted: false }),
    ]);

    return responseUtil.success(res, "Help requests fetched", {
      requests: requests.map((h) => formatHelp(h, req.user?.id)),
      pagination: paginationOf(page, limit, totalCount),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch help requests", error.message);
  }
};

export const createHelpRequest = async (req, res) => {
  try {
    if (!(await requireDoerOrMember(req, res))) return;

    const body = req.body || {};
    const tag = String(body.tag || "GENERAL").toUpperCase();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const contactPhone = String(body.contactPhone || "").trim();
    const contactEmail = String(body.contactEmail || "").trim();

    if (!HELP_REQUEST_TAGS.includes(tag)) return responseUtil.badRequest(res, "Choose General or Emergency");
    if (!title) return responseUtil.badRequest(res, "Say what you need help with");
    if (title.length > 120) return responseUtil.badRequest(res, "Title cannot exceed 120 characters");
    if (description.length > 1000) return responseUtil.badRequest(res, "Description cannot exceed 1000 characters");
    if (!contactPhone && !contactEmail) {
      return responseUtil.badRequest(res, "Add a phone number or email so people can reach you");
    }
    if (contactPhone && !/^[0-9+\-\s]{7,20}$/.test(contactPhone)) {
      return responseUtil.badRequest(res, "Enter a valid phone number");
    }
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) {
      return responseUtil.badRequest(res, "Enter a valid email");
    }

    let deadline = null;
    if (body.deadline) {
      deadline = new Date(body.deadline);
      if (Number.isNaN(deadline.getTime())) return responseUtil.badRequest(res, "Invalid deadline");
      if (deadline.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
        return responseUtil.badRequest(res, "Deadline cannot be in the past");
      }
    }

    const user = await User.findById(req.user.id).select("name city").lean();
    const help = await HelpRequest.create({
      user: req.user.id,
      authorName: user?.name || "Member",
      tag,
      title,
      description,
      deadline,
      contactName: String(body.contactName || user?.name || "").trim().slice(0, 100),
      contactPhone,
      contactEmail,
      city: String(body.city || user?.city || "").trim().slice(0, 100),
    });

    const payload = {
      category: "COMMUNITY",
      type: tag === "EMERGENCY" ? "HELP_EMERGENCY" : "HELP_REQUEST",
      title: tag === "EMERGENCY" ? `Emergency: ${title}` : `${user?.name || "A connection"} needs help`,
      body: tag === "EMERGENCY" ? `${user?.name || "A member"} needs urgent help${help.city ? ` in ${help.city}` : ""}.` : title,
      data: { screen: "Community", tab: "help", helpId: String(help._id) },
    };

    const notify =
      tag === "EMERGENCY"
        ? notifyAllUsers({ ...payload, excludeUserIds: [req.user.id] })
        : connectionIdsOf(req.user.id).then((ids) => notifyUsers({ ...payload, userIds: ids }));
    notify.catch((err) => console.error("[COMMUNITY] Help notify failed:", err.message));

    return responseUtil.created(res, "Help request posted", {
      request: formatHelp({ ...help.toObject(), user: { _id: req.user.id, name: user?.name } }, req.user.id),
    });
  } catch (error) {
    if (error.name === "ValidationError") return responseUtil.badRequest(res, error.message);
    return responseUtil.internalError(res, "Failed to post help request", error.message);
  }
};

export const resolveHelpRequest = async (req, res) => {
  try {
    const help = await HelpRequest.findById(req.params.id);
    if (!help) return responseUtil.notFound(res, "Help request not found");
    if (req.user.userType !== "admin" && String(help.user) !== String(req.user.id)) {
      return responseUtil.forbidden(res, "Only the person who asked can close this request");
    }
    help.status = "RESOLVED";
    help.resolvedAt = new Date();
    await help.save();
    return responseUtil.success(res, "Marked as resolved", { request: formatHelp(help, req.user.id) });
  } catch (error) {
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid request ID");
    return responseUtil.internalError(res, "Failed to update help request", error.message);
  }
};

export const deleteHelpRequest = async (req, res) => {
  try {
    const help = await HelpRequest.findById(req.params.id);
    if (!help) return responseUtil.notFound(res, "Help request not found");
    if (req.user.userType !== "admin" && String(help.user) !== String(req.user.id)) {
      return responseUtil.forbidden(res, "You can only delete your own request");
    }
    help.isDeleted = true;
    help.deletedAt = new Date();
    await help.save();
    return responseUtil.success(res, "Help request deleted");
  } catch (error) {
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid request ID");
    return responseUtil.internalError(res, "Failed to delete help request", error.message);
  }
};

export default {
  getCommunityMeta,
  listWeeklyUpdates,
  createWeeklyUpdate,
  deleteWeeklyUpdate,
  listHelpRequests,
  createHelpRequest,
  resolveHelpRequest,
  deleteHelpRequest,
};
