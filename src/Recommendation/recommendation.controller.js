/**
 * @fileoverview Recommendation controller.
 * Members & admins can create; all authenticated users can view.
 * @module Recommendation/controller
 */

import Recommendation from "../../schema/Recommendation.schema.js";
import RecommendationComment from "../../schema/RecommendationComment.schema.js";
import RecommendationCommentLike from "../../schema/RecommendationCommentLike.schema.js";
import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import RecommendationLike from "../../schema/RecommendationLike.schema.js";
import RecommendationBookmark from "../../schema/RecommendationBookmark.schema.js";
import responseUtil from "../../utils/response.util.js";
import { getIsDoer, getIsMember } from "../../middleware/membership.middleware.js";
import {
  RECOMMENDATION_TAGS,
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_MAIN_TAGS,
} from "./recommendation.constants.js";

/** 7 days in milliseconds — feed window */
const FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Attach per-viewer flags (isLiked, isBookmarked) to a list of plain
 * recommendation objects for the given user.
 */
const enrichForViewer = async (recs, userId) => {
  if (!userId || recs.length === 0) {
    return recs.map((r) => ({ ...r, isLiked: false, isBookmarked: false }));
  }
  const ids = recs.map((r) => r._id);
  const [likes, bookmarks] = await Promise.all([
    RecommendationLike.find({ user: userId, recommendation: { $in: ids } })
      .select("recommendation")
      .lean(),
    RecommendationBookmark.find({ user: userId, recommendation: { $in: ids } })
      .select("recommendation")
      .lean(),
  ]);
  const likedSet = new Set(likes.map((l) => l.recommendation.toString()));
  const bookmarkedSet = new Set(bookmarks.map((b) => b.recommendation.toString()));
  return recs.map((r) => ({
    ...r,
    isLiked: likedSet.has(r._id.toString()),
    isBookmarked: bookmarkedSet.has(r._id.toString()),
  }));
};

/**
 * Resolve the author identity (type + display name) from req.user.
 */
const resolveAuthor = async (reqUser) => {
  const isAdmin = reqUser.userType === "admin";
  const authorType = isAdmin ? "Admin" : "User";

  let authorName = "";
  if (isAdmin) {
    const admin = await Admin.findById(reqUser.id).select("name").lean();
    authorName = admin?.name || "Admin";
  } else {
    const user = await User.findById(reqUser.id).select("name").lean();
    authorName = user?.name || "Member";
  }

  return { authorType, authorId: reqUser.id, authorName };
};

/**
 * Get the list of predefined tags (for the post composer).
 * @route GET /api/app/recommendations/tags
 */
export const getRecommendationTags = async (_req, res) => {
  return responseUtil.success(res, "Tags fetched successfully", {
    tags: RECOMMENDATION_TAGS,
    mainTags: RECOMMENDATION_MAIN_TAGS,
    categories: RECOMMENDATION_CATEGORIES,
  });
};

/**
 * Create a recommendation. Restricted to members & admins (enforced by middleware).
 * @route POST /api/app/recommendations
 */
export const createRecommendation = async (req, res) => {
  try {
    const { text, tags } = req.body;
    const { authorType, authorId, authorName } = await resolveAuthor(req.user);

    const recommendation = await Recommendation.create({
      authorType,
      author: authorId,
      authorName,
      text,
      tags,
    });

    return responseUtil.created(res, "Recommendation posted successfully", {
      recommendation,
    });
  } catch (error) {
    console.error("Create recommendation error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to post recommendation", error.message);
  }
};

/**
 * List recommendations (feed — last 7 days, all authenticated users).
 * Supports tag filter + pagination.
 * @route GET /api/app/recommendations
 */
export const getAllRecommendations = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortOrder = "desc", tag, author } = req.query;

    // The global feed only shows the last 7 days. When viewing a specific
    // member's recommendations, show all of theirs (no date window).
    const query = {};
    if (author) {
      query.author = author;
    } else {
      query.createdAt = { $gte: new Date(Date.now() - FEED_WINDOW_MS) };
    }
    if (tag) query.tags = tag;

    const skip = (page - 1) * limit;
    const sort = { createdAt: sortOrder === "asc" ? 1 : -1 };

    const [rawRecs, totalCount, viewerIsDoer, viewerIsMember] = await Promise.all([
      Recommendation.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate("author", "name")
        .lean(),
      Recommendation.countDocuments(query),
      getIsDoer(req.user),
      getIsMember(req.user),
    ]);

    const recommendations = await enrichForViewer(rawRecs, req.user?.id);
    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Recommendations fetched successfully", {
      recommendations,
      viewerIsDoer,
      viewerIsMember,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get recommendations error:", error);
    return responseUtil.internalError(res, "Failed to fetch recommendations", error.message);
  }
};

/**
 * List the current user's own recommendations (no date filter — full profile view).
 * @route GET /api/app/recommendations/mine
 */
export const getMyRecommendations = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { author: req.user.id };

    const [rawRecs, totalCount] = await Promise.all([
      Recommendation.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Recommendation.countDocuments(query),
    ]);

    const recommendations = await enrichForViewer(rawRecs, req.user.id);
    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Your recommendations fetched successfully", {
      recommendations,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get my recommendations error:", error);
    return responseUtil.internalError(res, "Failed to fetch your recommendations", error.message);
  }
};

/**
 * Delete a recommendation. Allowed for the author or any admin.
 * @route DELETE /api/app/recommendations/:id  (and admin route)
 */
export const deleteRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const recommendation = await Recommendation.findById(id);

    if (!recommendation) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    const isAdmin = req.user.userType === "admin";
    const isAuthor = recommendation.author.toString() === req.user.id;

    if (!isAdmin && !isAuthor) {
      return responseUtil.forbidden(res, "You can only delete your own recommendations");
    }

    await recommendation.softDelete();

    return responseUtil.success(res, "Recommendation deleted successfully");
  } catch (error) {
    console.error("Delete recommendation error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }

    return responseUtil.internalError(res, "Failed to delete recommendation", error.message);
  }
};

/**
 * Like a recommendation (any authenticated user). Idempotent.
 * @route POST /api/app/recommendations/:id/like
 */
export const likeRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const recommendation = await Recommendation.findById(id);
    if (!recommendation) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    try {
      await RecommendationLike.create({ recommendation: id, user: req.user.id });
      recommendation.likeCount = (recommendation.likeCount || 0) + 1;
      await recommendation.save({ validateModifiedOnly: true });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    return responseUtil.success(res, "Recommendation liked", {
      likeCount: recommendation.likeCount,
      isLiked: true,
    });
  } catch (error) {
    console.error("Like recommendation error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }
    return responseUtil.internalError(res, "Failed to like recommendation", error.message);
  }
};

/**
 * Unlike a recommendation (any authenticated user). Idempotent.
 * @route DELETE /api/app/recommendations/:id/like
 */
export const unlikeRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const recommendation = await Recommendation.findById(id);
    if (!recommendation) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    const removed = await RecommendationLike.findOneAndDelete({
      recommendation: id,
      user: req.user.id,
    });
    if (removed) {
      recommendation.likeCount = Math.max(0, (recommendation.likeCount || 0) - 1);
      await recommendation.save({ validateModifiedOnly: true });
    }

    return responseUtil.success(res, "Recommendation unliked", {
      likeCount: recommendation.likeCount,
      isLiked: false,
    });
  } catch (error) {
    console.error("Unlike recommendation error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }
    return responseUtil.internalError(res, "Failed to unlike recommendation", error.message);
  }
};

/**
 * Bookmark a recommendation (Doers only — enforced by middleware). Idempotent.
 * @route POST /api/app/recommendations/:id/bookmark
 */
export const bookmarkRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await Recommendation.exists({ _id: id });
    if (!exists) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    try {
      await RecommendationBookmark.create({ recommendation: id, user: req.user.id });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    return responseUtil.success(res, "Recommendation bookmarked", { isBookmarked: true });
  } catch (error) {
    console.error("Bookmark recommendation error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }
    return responseUtil.internalError(res, "Failed to bookmark recommendation", error.message);
  }
};

/**
 * Remove a bookmark (Doers only). Idempotent.
 * @route DELETE /api/app/recommendations/:id/bookmark
 */
export const unbookmarkRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    await RecommendationBookmark.findOneAndDelete({ recommendation: id, user: req.user.id });
    return responseUtil.success(res, "Bookmark removed", { isBookmarked: false });
  } catch (error) {
    console.error("Unbookmark recommendation error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }
    return responseUtil.internalError(res, "Failed to remove bookmark", error.message);
  }
};

/**
 * List the current user's bookmarked recommendations.
 * @route GET /api/app/recommendations/bookmarks
 */
export const getMyBookmarks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [bookmarks, totalCount] = await Promise.all([
      RecommendationBookmark.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate({ path: "recommendation", populate: { path: "author", select: "name" } })
        .lean(),
      RecommendationBookmark.countDocuments({ user: req.user.id }),
    ]);

    const recommendations = bookmarks
      .map((b) => b.recommendation)
      .filter(Boolean)
      .map((r) => ({ ...r, isBookmarked: true }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Bookmarked recommendations fetched successfully", {
      recommendations,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    return responseUtil.internalError(res, "Failed to fetch bookmarks", error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get comments for a recommendation, sorted by most liked then newest.
 * @route GET /api/app/recommendations/:id/comments
 */
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await Recommendation.exists({ _id: id });
    if (!exists) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    const comments = await RecommendationComment.find({ recommendation: id })
      .sort({ likeCount: -1, createdAt: -1 })
      .lean();

    // Attach isLiked per comment for the viewer.
    const userId = req.user?.id;
    let enriched = comments.map((c) => ({ ...c, isLiked: false }));

    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c._id);
      const likes = await RecommendationCommentLike.find({
        user: userId,
        comment: { $in: commentIds },
      })
        .select("comment")
        .lean();
      const likedSet = new Set(likes.map((l) => l.comment.toString()));
      enriched = comments.map((c) => ({
        ...c,
        isLiked: likedSet.has(c._id.toString()),
      }));
    }

    return responseUtil.success(res, "Comments fetched successfully", {
      comments: enriched,
      totalCount: enriched.length,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid recommendation ID");
    }
    return responseUtil.internalError(res, "Failed to fetch comments", error.message);
  }
};

/**
 * Create a comment on a recommendation. Members & admins only (enforced by middleware).
 * @route POST /api/app/recommendations/:id/comments
 */
export const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const recommendation = await Recommendation.findById(id);
    if (!recommendation) {
      return responseUtil.notFound(res, "Recommendation not found");
    }

    const { authorType, authorId, authorName } = await resolveAuthor(req.user);

    const comment = await RecommendationComment.create({
      recommendation: id,
      authorType,
      author: authorId,
      authorName,
      text,
    });

    // Bump comment count on the parent recommendation.
    await Recommendation.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });

    return responseUtil.created(res, "Comment posted successfully", {
      comment: { ...comment.toObject(), isLiked: false },
    });
  } catch (error) {
    console.error("Create comment error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }
    return responseUtil.internalError(res, "Failed to post comment", error.message);
  }
};

/**
 * Delete a comment. Allowed for the comment author or any admin.
 * @route DELETE /api/app/recommendations/:id/comments/:cid
 */
export const deleteComment = async (req, res) => {
  try {
    const { id, cid } = req.params;
    const comment = await RecommendationComment.findById(cid);

    if (!comment || comment.recommendation.toString() !== id) {
      return responseUtil.notFound(res, "Comment not found");
    }

    const isAdmin = req.user.userType === "admin";
    const isAuthor = comment.author.toString() === req.user.id;

    if (!isAdmin && !isAuthor) {
      return responseUtil.forbidden(res, "You can only delete your own comments");
    }

    await comment.softDelete();
    await Recommendation.findByIdAndUpdate(id, {
      $inc: { commentCount: -1 },
      $max: { commentCount: 0 }, // guard against going negative
    });

    return responseUtil.success(res, "Comment deleted successfully");
  } catch (error) {
    console.error("Delete comment error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID");
    }
    return responseUtil.internalError(res, "Failed to delete comment", error.message);
  }
};

/**
 * Like a comment (any authenticated user). Idempotent.
 * @route POST /api/app/recommendations/:id/comments/:cid/like
 */
export const likeComment = async (req, res) => {
  try {
    const { cid } = req.params;
    const comment = await RecommendationComment.findById(cid);
    if (!comment) {
      return responseUtil.notFound(res, "Comment not found");
    }

    try {
      await RecommendationCommentLike.create({ comment: cid, user: req.user.id });
      comment.likeCount = (comment.likeCount || 0) + 1;
      await comment.save();
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    return responseUtil.success(res, "Comment liked", {
      likeCount: comment.likeCount,
      isLiked: true,
    });
  } catch (error) {
    console.error("Like comment error:", error);
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid ID");
    return responseUtil.internalError(res, "Failed to like comment", error.message);
  }
};

/**
 * Unlike a comment (any authenticated user). Idempotent.
 * @route DELETE /api/app/recommendations/:id/comments/:cid/like
 */
export const unlikeComment = async (req, res) => {
  try {
    const { cid } = req.params;
    const comment = await RecommendationComment.findById(cid);
    if (!comment) {
      return responseUtil.notFound(res, "Comment not found");
    }

    const removed = await RecommendationCommentLike.findOneAndDelete({
      comment: cid,
      user: req.user.id,
    });
    if (removed) {
      comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1);
      await comment.save();
    }

    return responseUtil.success(res, "Comment unliked", {
      likeCount: comment.likeCount,
      isLiked: false,
    });
  } catch (error) {
    console.error("Unlike comment error:", error);
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid ID");
    return responseUtil.internalError(res, "Failed to unlike comment", error.message);
  }
};

export default {
  getRecommendationTags,
  createRecommendation,
  getAllRecommendations,
  getMyRecommendations,
  deleteRecommendation,
  likeRecommendation,
  unlikeRecommendation,
  bookmarkRecommendation,
  unbookmarkRecommendation,
  getMyBookmarks,
  getComments,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment,
};
