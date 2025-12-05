/**
 * @fileoverview SOS Quiz validation schemas using Joi
 * @module validation/sos-quiz
 */

import Joi from "joi";

/**
 * MongoDB ObjectId validation pattern
 */
const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

/**
 * MongoDB ObjectId validation schema
 */
const mongoId = Joi.string().regex(mongoIdPattern).messages({
  "string.pattern.base": "Invalid ID format",
});

/**
 * SOS Option schema for quiz questions
 */
const sosOptionSchema = Joi.object({
  text: Joi.string().required().trim().max(500).messages({
    "string.empty": "Option text is required",
    "string.max": "Option text cannot exceed 500 characters",
  }),
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.boolean())
    .required()
    .messages({
      "any.required": "Option value is required",
    }),
  order: Joi.number().integer().min(0).default(0),
});

/**
 * SOS Question schema for daily quizzes
 * Supports: text, single-choice, multiple-choice, scale, boolean
 */
const sosQuestionSchema = Joi.object({
  questionText: Joi.string().required().trim().max(1000).messages({
    "string.empty": "Question text is required",
    "string.max": "Question text cannot exceed 1000 characters",
  }),
  questionType: Joi.string()
    .required()
    .valid("text", "single-choice", "multiple-choice", "scale", "boolean")
    .messages({
      "any.only": "Question type must be text, single-choice, multiple-choice, scale, or boolean",
    }),
  options: Joi.array().items(sosOptionSchema).when("questionType", {
    is: Joi.string().valid("single-choice", "multiple-choice", "scale"),
    then: Joi.array().min(2).required().messages({
      "array.min": "Choice-based questions must have at least 2 options",
    }),
    otherwise: Joi.array().optional(),
  }),
  isRequired: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).default(0),
  points: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional(),
});

/**
 * SOS Program validation schemas
 */
export const programSchemas = {
  /**
   * Create program validation
   */
  create: Joi.object({
    title: Joi.string().required().trim().max(200).messages({
      "string.empty": "Program title is required",
      "string.max": "Title cannot exceed 200 characters",
    }),
    type: Joi.string().required().valid("GSOS", "ISOS").messages({
      "any.only": "Program type must be GSOS or ISOS",
    }),
    description: Joi.string().required().trim().max(2000).messages({
      "string.empty": "Program description is required",
      "string.max": "Description cannot exceed 2000 characters",
    }),
    durationDays: Joi.number()
      .required()
      .integer()
      .min(1)
      .max(30)
      .when("type", {
        is: "GSOS",
        then: Joi.number().valid(1).messages({
          "any.only": "GSOS programs must have exactly 1 day duration",
        }),
        otherwise: Joi.number().valid(7, 15, 30).messages({
          "any.only": "ISOS programs must be 7, 15, or 30 days",
        }),
      }),
    isActive: Joi.boolean().default(true),
    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Please provide a valid image URL",
    }),
  }),

  /**
   * Update program validation
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).messages({
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: Joi.string().trim().max(2000).messages({
      "string.max": "Description cannot exceed 2000 characters",
    }),
    isActive: Joi.boolean(),
    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Please provide a valid image URL",
    }),
  }).min(1),

  /**
   * List programs query validation
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "title", "type", "durationDays").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    type: Joi.string().valid("GSOS", "ISOS").optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().max(100).optional(),
  }),

  /**
   * Program ID param validation
   */
  programId: Joi.object({
    programId: mongoId.required(),
  }),
};

/**
 * SOS Quiz validation schemas
 */
export const sosQuizSchemas = {
  /**
   * Create quiz validation
   */
  create: Joi.object({
    programId: mongoId.required().messages({
      "string.pattern.base": "Invalid program ID format",
    }),
    dayNumber: Joi.number().required().integer().min(1).messages({
      "number.min": "Day number must be at least 1",
    }),
    title: Joi.string().required().trim().max(200).messages({
      "string.empty": "Quiz title is required",
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: Joi.string().trim().max(1000).optional().messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
    questions: Joi.array().items(sosQuestionSchema).min(1).required().messages({
      "array.min": "Quiz must have at least one question",
    }),
    isActive: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0),
  }),

  /**
   * Update quiz validation
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).messages({
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: Joi.string().trim().max(1000).optional().allow("").messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
    questions: Joi.array().items(sosQuestionSchema).min(1).messages({
      "array.min": "Quiz must have at least one question",
    }),
    isActive: Joi.boolean(),
    order: Joi.number().integer().min(0),
  }).min(1),

  /**
   * List quizzes query validation
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "dayNumber", "title", "order").default("dayNumber"),
    sortOrder: Joi.string().valid("asc", "desc").default("asc"),
    programId: mongoId.optional(),
    dayNumber: Joi.number().integer().min(1).optional(),
    isActive: Joi.boolean().optional(),
  }),

  /**
   * Quiz ID param validation
   */
  quizId: Joi.object({
    quizId: mongoId.required(),
  }),

  /**
   * Program ID param validation (for nested routes)
   */
  programIdParam: Joi.object({
    programId: mongoId.required(),
  }),

  /**
   * Day number param validation
   */
  dayParam: Joi.object({
    programId: mongoId.required(),
    dayNumber: Joi.number().integer().min(1).required(),
  }),
};

/**
 * User progress validation schemas
 */
export const progressSchemas = {
  /**
   * Start program validation
   */
  startProgram: Joi.object({
    programId: mongoId.required().messages({
      "string.pattern.base": "Invalid program ID format",
    }),
  }),

  /**
   * Submit quiz answers validation
   */
  submitQuiz: Joi.object({
    responses: Joi.array()
      .items(
        Joi.object({
          questionId: mongoId.required(),
          answer: Joi.alternatives()
            .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array().items(Joi.string()))
            .required()
            .messages({
              "any.required": "Answer is required",
            }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one response is required",
      }),
  }),

  /**
   * List user progress query validation
   */
  listProgress: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid("not_started", "in_progress", "completed", "abandoned").optional(),
    programId: mongoId.optional(),
  }),

  /**
   * Progress ID param validation
   */
  progressId: Joi.object({
    progressId: mongoId.required(),
  }),

  /**
   * User progress params validation
   */
  userProgressParams: Joi.object({
    programId: mongoId.required(),
  }),

  /**
   * Day submission params validation
   */
  daySubmitParams: Joi.object({
    programId: mongoId.required(),
    dayNumber: Joi.number().integer().min(1).required(),
  }),

  /**
   * Admin list all progress query validation
   */
  adminListProgress: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("createdAt", "lastActivityAt", "totalScore", "daysCompleted")
      .default("lastActivityAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    status: Joi.string().valid("not_started", "in_progress", "completed", "abandoned").optional(),
    programId: mongoId.optional(),
    userId: mongoId.optional(),
  }),

  /**
   * Leaderboard query validation
   */
  leaderboard: Joi.object({
    programId: mongoId.required(),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};
