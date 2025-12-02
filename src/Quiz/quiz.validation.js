/**
 * @fileoverview Quiz validation schemas using Joi
 * @module validation/quiz
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
 * Option schema for MCQ questions
 */
const optionSchema = Joi.object({
  text: Joi.string().trim().max(500).required().messages({
    "string.empty": "Option text is required",
    "string.max": "Option text cannot exceed 500 characters",
  }),
  isCorrect: Joi.boolean().default(false),
});

/**
 * Question schema for quiz questions
 */
const questionSchema = Joi.object({
  questionText: Joi.string().trim().max(1000).required().messages({
    "string.empty": "Question text is required",
    "string.max": "Question text cannot exceed 1000 characters",
  }),
  questionType: Joi.string()
    .valid("QNA", "MCQ_SINGLE", "MCQ_MULTIPLE")
    .required()
    .messages({
      "any.only": "Question type must be QNA, MCQ_SINGLE, or MCQ_MULTIPLE",
      "any.required": "Question type is required",
    }),
  options: Joi.when("questionType", {
    is: Joi.string().valid("MCQ_SINGLE", "MCQ_MULTIPLE"),
    then: Joi.array().items(optionSchema).min(2).required().messages({
      "array.min": "MCQ questions must have at least 2 options",
      "any.required": "Options are required for MCQ questions",
    }),
    otherwise: Joi.array().items(optionSchema).optional(),
  }),
  correctAnswer: Joi.when("questionType", {
    is: "QNA",
    then: Joi.string().trim().max(2000).optional().messages({
      "string.max": "Correct answer cannot exceed 2000 characters",
    }),
    otherwise: Joi.string().optional(),
  }),
  points: Joi.number().min(0).default(1).messages({
    "number.min": "Points cannot be negative",
  }),
  isRequired: Joi.boolean().default(false),
  order: Joi.number().integer().min(0).optional(),
});

/**
 * Live data schema for scheduled quizzes
 */
const liveDataSchema = Joi.object({
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().greater(Joi.ref("startTime")).optional().messages({
    "date.greater": "End time must be after start time",
  }),
  isScheduled: Joi.boolean().default(false),
});

/**
 * Answer schema for quiz submission
 */
const answerSchema = Joi.object({
  questionId: mongoId.required().messages({
    "any.required": "Question ID is required",
  }),
  answer: Joi.string().trim().max(5000).optional().allow("", null).messages({
    "string.max": "Answer cannot exceed 5000 characters",
  }),
  selectedOptions: Joi.array().items(Joi.number().integer().min(0)).optional(),
});

/**
 * Grade schema for grading QNA answers
 */
const gradeSchema = Joi.object({
  questionId: mongoId.required().messages({
    "any.required": "Question ID is required",
  }),
  isCorrect: Joi.boolean().required().messages({
    "any.required": "isCorrect is required",
  }),
  points: Joi.number().min(0).required().messages({
    "number.min": "Points cannot be negative",
    "any.required": "Points are required",
  }),
});

/**
 * Quiz validation schemas
 */
export const quizSchemas = {
  /**
   * Create quiz schema
   */
  create: Joi.object({
    title: Joi.string().trim().max(200).required().messages({
      "string.empty": "Quiz title is required",
      "string.max": "Quiz title cannot exceed 200 characters",
    }),
    shortDescription: Joi.string().trim().max(500).optional().allow("", null).messages({
      "string.max": "Short description cannot exceed 500 characters",
    }),
    isPaid: Joi.boolean().default(false),
    price: Joi.when("isPaid", {
      is: true,
      then: Joi.number().min(1).required().messages({
        "number.min": "Price must be greater than 0 for paid quizzes",
        "any.required": "Price is required for paid quizzes",
      }),
      otherwise: Joi.number().min(0).default(0),
    }),
    compareAtPrice: Joi.number().min(0).optional().allow(null).messages({
      "number.min": "Compare at price cannot be negative",
    }),
    enrollmentType: Joi.string()
      .valid("REGISTERED", "OPEN")
      .default("OPEN")
      .messages({
        "any.only": "Enrollment type must be REGISTERED or OPEN",
      }),
    questions: Joi.array().items(questionSchema).optional(),
    liveData: liveDataSchema.optional(),
    timeLimit: Joi.number().integer().min(1).max(480).optional().allow(null).messages({
      "number.min": "Time limit must be at least 1 minute",
      "number.max": "Time limit cannot exceed 480 minutes (8 hours)",
    }),
    shuffleQuestions: Joi.boolean().default(false),
    showResults: Joi.boolean().default(true),
    maxAttempts: Joi.number().integer().min(1).optional().allow(null).messages({
      "number.min": "Maximum attempts must be at least 1",
    }),
    imageUrl: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid image URL",
    }),
    isLive: Joi.boolean().default(false),
  }),

  /**
   * Update quiz schema
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).optional().messages({
      "string.max": "Quiz title cannot exceed 200 characters",
    }),
    shortDescription: Joi.string().trim().max(500).optional().allow("", null).messages({
      "string.max": "Short description cannot exceed 500 characters",
    }),
    isPaid: Joi.boolean().optional(),
    price: Joi.number().min(0).optional().messages({
      "number.min": "Price cannot be negative",
    }),
    compareAtPrice: Joi.number().min(0).optional().allow(null).messages({
      "number.min": "Compare at price cannot be negative",
    }),
    enrollmentType: Joi.string()
      .valid("REGISTERED", "OPEN")
      .optional()
      .messages({
        "any.only": "Enrollment type must be REGISTERED or OPEN",
      }),
    questions: Joi.array().items(questionSchema).optional(),
    liveData: liveDataSchema.optional(),
    timeLimit: Joi.number().integer().min(1).max(480).optional().allow(null).messages({
      "number.min": "Time limit must be at least 1 minute",
      "number.max": "Time limit cannot exceed 480 minutes (8 hours)",
    }),
    shuffleQuestions: Joi.boolean().optional(),
    showResults: Joi.boolean().optional(),
    maxAttempts: Joi.number().integer().min(1).optional().allow(null).messages({
      "number.min": "Maximum attempts must be at least 1",
    }),
    imageUrl: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid image URL",
    }),
    isLive: Joi.boolean().optional(),
  }),

  /**
   * Query parameters for listing quizzes
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("title", "createdAt", "price", "questionCount")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    isLive: Joi.boolean().optional(),
    isPaid: Joi.boolean().optional(),
    enrollmentType: Joi.string().valid("REGISTERED", "OPEN").optional(),
    search: Joi.string().trim().optional(),
  }),

  /**
   * Quiz ID parameter validation
   */
  quizId: Joi.object({
    id: mongoId.required(),
  }),

  /**
   * Question params validation
   */
  questionParams: Joi.object({
    id: mongoId.required(),
    questionId: mongoId.required(),
  }),

  /**
   * Submission params validation
   */
  submissionParams: Joi.object({
    id: mongoId.required(),
    submissionId: mongoId.required(),
  }),

  /**
   * Add questions schema
   */
  addQuestions: Joi.object({
    questions: Joi.array().items(questionSchema).min(1).required().messages({
      "array.min": "At least one question is required",
      "any.required": "Questions array is required",
    }),
  }),

  /**
   * Update question schema
   */
  updateQuestion: Joi.object({
    questionText: Joi.string().trim().max(1000).optional().messages({
      "string.max": "Question text cannot exceed 1000 characters",
    }),
    questionType: Joi.string()
      .valid("QNA", "MCQ_SINGLE", "MCQ_MULTIPLE")
      .optional()
      .messages({
        "any.only": "Question type must be QNA, MCQ_SINGLE, or MCQ_MULTIPLE",
      }),
    options: Joi.array().items(optionSchema).min(2).optional().messages({
      "array.min": "MCQ questions must have at least 2 options",
    }),
    correctAnswer: Joi.string().trim().max(2000).optional().allow("", null).messages({
      "string.max": "Correct answer cannot exceed 2000 characters",
    }),
    points: Joi.number().min(0).optional().messages({
      "number.min": "Points cannot be negative",
    }),
    isRequired: Joi.boolean().optional(),
    order: Joi.number().integer().min(0).optional(),
  }),

  /**
   * Submit quiz schema
   */
  submitQuiz: Joi.object({
    answers: Joi.array().items(answerSchema).required().messages({
      "any.required": "Answers array is required",
    }),
    timeTaken: Joi.number().integer().min(0).optional().messages({
      "number.min": "Time taken cannot be negative",
    }),
  }),

  /**
   * Submission list query params
   */
  submissionList: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid("PENDING", "GRADED", "REVIEWED").optional(),
  }),

  /**
   * Grade submission schema
   */
  gradeSubmission: Joi.object({
    grades: Joi.array().items(gradeSchema).min(1).required().messages({
      "array.min": "At least one grade is required",
      "any.required": "Grades array is required",
    }),
  }),
};

export default quizSchemas;
