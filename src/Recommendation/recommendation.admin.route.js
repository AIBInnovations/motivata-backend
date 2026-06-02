/**
 * @fileoverview Admin recommendation routes.
 * Base path: /api/web/recommendations
 * @module Recommendation/adminRoute
 */

import express from "express";
import {
  getRecommendationTags,
  createRecommendation,
  getAllRecommendations,
  deleteRecommendation,
} from "./recommendation.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middleware/validation.middleware.js";
import { recommendationSchemas } from "./recommendation.validation.js";

const router = express.Router();

// All admin recommendation routes require an authenticated admin.
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/recommendations/tags
 * @desc    Get the predefined tag list
 * @access  Admin
 */
router.get("/tags", getRecommendationTags);

/**
 * @route   GET /api/web/recommendations
 * @desc    List all recommendations (with tag filter + pagination)
 * @access  Admin
 */
router.get("/", validateQuery(recommendationSchemas.list), getAllRecommendations);

/**
 * @route   POST /api/web/recommendations
 * @desc    Create a recommendation as admin
 * @access  Admin
 */
router.post("/", validateBody(recommendationSchemas.create), createRecommendation);

/**
 * @route   DELETE /api/web/recommendations/:id
 * @desc    Delete any recommendation
 * @access  Admin
 */
router.delete(
  "/:id",
  validateParams(recommendationSchemas.recommendationId),
  deleteRecommendation
);

export default router;
