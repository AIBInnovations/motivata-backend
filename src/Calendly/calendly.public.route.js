/**
 * @fileoverview Public routes for Calendly slots (no auth required)
 * @module routes/public/calendly
 */

import express from "express";
import Joi from "joi";
import { getAvailableSlots } from "./calendly.controller.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";

/** @type {express.Router} */
const router = express.Router();

/**
 * Optional authentication - allows both authenticated and unauthenticated access
 */
router.use(optionalAuth);

/**
 * @route   GET /api/app/calendly/slots/:eventTypeUri
 * @desc    Get available time slots for an event type
 * @access  Public (no auth required)
 * @param   {string} eventTypeUri - URI-encoded Calendly event type URI
 * @query   {string} [start_date] - Start date (YYYY-MM-DD), defaults to today
 * @query   {string} [end_date] - End date (YYYY-MM-DD), defaults to 30 days from start
 * @returns {Object} Available slots
 */
router.get(
  "/slots/:eventTypeUri",
  validateParams(
    Joi.object({
      eventTypeUri: Joi.string().required().messages({
        "any.required": "Event type URI is required",
      }),
    })
  ),
  validateQuery(
    Joi.object({
      start_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .messages({
          "string.pattern.base": "start_date must be in YYYY-MM-DD format",
        }),
      end_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .messages({
          "string.pattern.base": "end_date must be in YYYY-MM-DD format",
        }),
    })
  ),
  getAvailableSlots
);

export default router;
