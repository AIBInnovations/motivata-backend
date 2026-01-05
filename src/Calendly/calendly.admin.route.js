/**
 * @fileoverview Admin routes for Calendly PAT management
 * @module routes/admin/calendly
 */

import express from "express";
import Joi from "joi";
import {
  configurePublic,
  saveToken,
  getConnectionStatus,
  disconnectCalendly,
  syncEventTypes,
} from "./calendly.controller.js";
import {
  authenticate,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validation.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   POST /api/web/calendly/configure-public
 * @desc    Configure Calendly using public URLs (Free plan compatible)
 * @access  Admin
 * @body    {string} calendlyUsername - Calendly username (e.g., "johndoe" from calendly.com/johndoe)
 * @body    {Array} eventTypes - Array of event types [{name, slug, duration}]
 */
router.post(
  "/configure-public",
  validateBody(
    Joi.object({
      calendlyUsername: Joi.string()
        .required()
        .min(3)
        .max(50)
        .pattern(/^[a-zA-Z0-9-_]+$/)
        .messages({
          "any.required": "Calendly username is required",
          "string.min": "Username must be at least 3 characters",
          "string.max": "Username must not exceed 50 characters",
          "string.pattern.base": "Username can only contain letters, numbers, hyphens, and underscores",
        }),
      eventTypes: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required().messages({
              "any.required": "Event type name is required",
            }),
            slug: Joi.string()
              .required()
              .pattern(/^[a-z0-9-]+$/)
              .messages({
                "any.required": "Event type slug is required",
                "string.pattern.base": "Slug can only contain lowercase letters, numbers, and hyphens",
              }),
            duration: Joi.number().optional().min(15).max(480).default(30).messages({
              "number.min": "Duration must be at least 15 minutes",
              "number.max": "Duration must not exceed 480 minutes",
            }),
          })
        )
        .min(1)
        .required()
        .messages({
          "any.required": "At least one event type is required",
          "array.min": "At least one event type is required",
        }),
    })
  ),
  configurePublic
);

/**
 * @route   POST /api/web/calendly/token
 * @desc    Save/Update Personal Access Token (Paid plan only)
 * @access  Admin
 * @body    {string} accessToken - Personal Access Token from Calendly
 */
router.post(
  "/token",
  validateBody(
    Joi.object({
      accessToken: Joi.string()
        .required()
        .min(40)
        .max(200)
        .messages({
          "any.required": "Personal Access Token is required",
          "string.min": "Invalid token format",
          "string.max": "Invalid token format",
        }),
    })
  ),
  saveToken
);

/**
 * @route   GET /api/web/calendly/connection/status
 * @desc    Get Calendly connection status
 * @access  Admin
 * @returns {Object} Connection status and event types
 */
router.get("/connection/status", getConnectionStatus);

/**
 * @route   POST /api/web/calendly/connection/disconnect
 * @desc    Disconnect Calendly (remove token and config)
 * @access  Super Admin only
 * @returns {Object} Success message
 */
router.post("/connection/disconnect", isSuperAdmin, disconnectCalendly);

/**
 * @route   POST /api/web/calendly/event-types/sync
 * @desc    Sync event types from Calendly
 * @access  Admin
 * @returns {Object} Updated event types list
 */
router.post("/event-types/sync", syncEventTypes);

export default router;
