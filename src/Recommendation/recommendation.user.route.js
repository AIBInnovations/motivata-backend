/**
 * @fileoverview User-facing recommendation routes.
 * Base path: /api/app/recommendations
 * @module Recommendation/userRoute
 */

import express from "express";
import {
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
} from "./recommendation.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireMemberOrAdmin, requireDoer } from "../../middleware/membership.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middleware/validation.middleware.js";
import { recommendationSchemas, commentSchemas } from "./recommendation.validation.js";

const router = express.Router();

// ─── Static / named routes first (before :id patterns) ───────────────────────

router.get("/tags", authenticate, getRecommendationTags);
router.get("/mine", authenticate, getMyRecommendations);
router.get("/bookmarks", authenticate, getMyBookmarks);

// ─── Feed ─────────────────────────────────────────────────────────────────────

router.get("/", authenticate, validateQuery(recommendationSchemas.list), getAllRecommendations);
router.post(
  "/",
  authenticate,
  requireMemberOrAdmin,
  validateBody(recommendationSchemas.create),
  createRecommendation
);

// ─── Recommendation-level interactions ───────────────────────────────────────

router.post(
  "/:id/like",
  authenticate,
  validateParams(recommendationSchemas.recommendationId),
  likeRecommendation
);
router.delete(
  "/:id/like",
  authenticate,
  validateParams(recommendationSchemas.recommendationId),
  unlikeRecommendation
);

router.post(
  "/:id/bookmark",
  authenticate,
  requireDoer,
  validateParams(recommendationSchemas.recommendationId),
  bookmarkRecommendation
);
router.delete(
  "/:id/bookmark",
  authenticate,
  requireDoer,
  validateParams(recommendationSchemas.recommendationId),
  unbookmarkRecommendation
);

// ─── Comments ─────────────────────────────────────────────────────────────────

/** Get all comments for a recommendation (everyone). */
router.get(
  "/:id/comments",
  authenticate,
  validateParams(recommendationSchemas.recommendationId),
  getComments
);

/** Post a comment (members & admins only). */
router.post(
  "/:id/comments",
  authenticate,
  requireMemberOrAdmin,
  validateBody(commentSchemas.create),
  createComment
);

/** Delete a comment (own or admin). */
router.delete(
  "/:id/comments/:cid",
  authenticate,
  validateParams(commentSchemas.commentId),
  deleteComment
);

/** Like a comment (everyone). */
router.post(
  "/:id/comments/:cid/like",
  authenticate,
  validateParams(commentSchemas.commentId),
  likeComment
);

/** Unlike a comment (everyone). */
router.delete(
  "/:id/comments/:cid/like",
  authenticate,
  validateParams(commentSchemas.commentId),
  unlikeComment
);

// ─── Delete recommendation ────────────────────────────────────────────────────

router.delete(
  "/:id",
  authenticate,
  validateParams(recommendationSchemas.recommendationId),
  deleteRecommendation
);

export default router;
