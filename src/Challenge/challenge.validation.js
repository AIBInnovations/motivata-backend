/**
 * @fileoverview Challenge validation schemas using Joi
 * @module validation/challenge
 */

import Joi from "joi";
import { ICON_KEYS } from "./challenge.icons.js";

const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

const iconField = Joi.string()
  .valid(...ICON_KEYS)
  .optional()
  .allow(null, "")
  .messages({
    "any.only": `icon must be one of: ${ICON_KEYS.join(", ")}`,
  });
const mongoId = Joi.string().regex(mongoIdPattern).messages({
  "string.pattern.base": "Invalid ID format",
});

/**
 * Task schema for challenge tasks
 */
const taskSchema = Joi.object({
  title: Joi.string().required().trim().max(200).messages({
    "string.empty": "Task title is required",
    "string.max": "Task title cannot exceed 200 characters",
  }),
  description: Joi.string().trim().max(500).optional().allow("").messages({
    "string.max": "Task description cannot exceed 500 characters",
  }),
  order: Joi.number().integer().min(0).default(0),
  icon: iconField,
});

/**
 * Challenge validation schemas
 */
export const challengeSchemas = {
  /**
   * Create challenge validation
   */
  create: Joi.object({
    title: Joi.string().required().trim().max(200).messages({
      "string.empty": "Challenge title is required",
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: Joi.string().required().trim().max(2000).messages({
      "string.empty": "Challenge description is required",
      "string.max": "Description cannot exceed 2000 characters",
    }),
    category: Joi.string()
      .required()
      .valid("personal", "professional", "relational")
      .messages({
        "any.only": "Invalid category",
      }),
    difficulty: Joi.string().valid("easy", "medium", "hard").default("medium"),
    tasks: Joi.array().items(taskSchema).min(1).required().messages({
      "array.min": "Challenge must have at least one task",
    }),
    durationDays: Joi.number().integer().min(1).max(365).optional().allow(null).messages({
      "number.min": "Duration must be at least 1 day",
      "number.max": "Duration cannot exceed 365 days",
    }),
    allowedDurations: Joi.array()
      .items(Joi.number().integer().min(1).max(365))
      .unique()
      .optional()
      .messages({
        "array.unique": "allowedDurations must not contain duplicates",
        "number.min": "Each allowed duration must be at least 1 day",
        "number.max": "Each allowed duration cannot exceed 365 days",
      }),
    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Please provide a valid image URL",
    }),
    icon: iconField,
    isActive: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0),
  }),

  /**
   * Update challenge validation
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).messages({
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: Joi.string().trim().max(2000).messages({
      "string.max": "Description cannot exceed 2000 characters",
    }),
    category: Joi.string()
      .valid("personal", "professional", "relational")
      .messages({
        "any.only": "Invalid category",
      }),
    difficulty: Joi.string().valid("easy", "medium", "hard"),
    tasks: Joi.array().items(taskSchema).min(1).messages({
      "array.min": "Challenge must have at least one task",
    }),
    durationDays: Joi.number().integer().min(1).max(365).optional().allow(null),
    allowedDurations: Joi.array()
      .items(Joi.number().integer().min(1).max(365))
      .unique()
      .optional()
      .messages({
        "array.unique": "allowedDurations must not contain duplicates",
      }),
    imageUrl: Joi.string().uri().optional().allow(""),
    icon: iconField,
    isActive: Joi.boolean(),
    order: Joi.number().integer().min(0),
  }).min(1),

  /**
   * List challenges query validation
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid("createdAt", "title", "category", "difficulty", "order").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    category: Joi.string()
      .valid("personal", "professional", "relational")
      .optional(),
    difficulty: Joi.string().valid("easy", "medium", "hard").optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().max(100).optional(),
  }),

  /**
   * Challenge ID param validation
   */
  challengeId: Joi.object({
    challengeId: mongoId.required(),
  }),

  /**
   * Task ID param validation
   */
  taskParams: Joi.object({
    challengeId: mongoId.required(),
    taskId: mongoId.required(),
  }),

  /**
   * Join challenge validation
   */
  join: Joi.object({
    challengeId: mongoId.required().messages({
      "string.pattern.base": "Invalid challenge ID format",
    }),
    durationDays: Joi.number().integer().min(1).max(365).optional().messages({
      "number.min": "Duration must be at least 1 day",
      "number.max": "Duration cannot exceed 365 days",
    }),
  }),

  /**
   * User challenges query validation
   */
  myChallenges: Joi.object({
    status: Joi.string().valid("active", "completed", "abandoned", "expired").optional(),
  }),

  /**
   * Admin user progress query validation
   */
  adminProgress: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid("createdAt", "lastActivityAt", "daysCompleted").default("lastActivityAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    challengeId: mongoId.optional(),
    userId: mongoId.optional(),
    status: Joi.string().valid("active", "completed", "abandoned", "expired").optional(),
  }),
};

export default challengeSchemas;
