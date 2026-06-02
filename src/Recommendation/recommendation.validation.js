/**
 * @fileoverview Joi validation schemas for the Recommendation feature.
 * @module Recommendation/validation
 */

import Joi from "joi";
import {
  RECOMMENDATION_TAGS,
  RECOMMENDATION_MAX_TAGS,
  RECOMMENDATION_MAX_WORDS,
  COMMENT_MAX_WORDS,
  countWords,
} from "./recommendation.constants.js";

const mongoId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "Invalid ID format" });

const wordLimitedText = Joi.string()
  .trim()
  .required()
  .custom((value, helpers) => {
    const words = countWords(value);
    if (words < 1) return helpers.error("any.required");
    if (words > RECOMMENDATION_MAX_WORDS) return helpers.error("string.maxWords");
    return value;
  })
  .messages({
    "string.empty": "Recommendation text is required",
    "any.required": "Recommendation text is required",
    "string.maxWords": `Recommendation cannot exceed ${RECOMMENDATION_MAX_WORDS} words`,
  });

const tagsField = Joi.array()
  .items(Joi.string().valid(...RECOMMENDATION_TAGS))
  .min(1)
  .max(RECOMMENDATION_MAX_TAGS)
  .unique()
  .required()
  .messages({
    "array.min": "Select at least one tag",
    "array.max": `Select up to ${RECOMMENDATION_MAX_TAGS} tags`,
    "array.unique": "Tags must be unique",
    "any.only": "One or more tags are not valid",
    "any.required": "At least one tag is required",
  });

const commentText = Joi.string()
  .trim()
  .required()
  .custom((value, helpers) => {
    const words = countWords(value);
    if (words < 1) return helpers.error("any.required");
    if (words > COMMENT_MAX_WORDS) return helpers.error("string.maxWords");
    return value;
  })
  .messages({
    "string.empty": "Comment text is required",
    "any.required": "Comment text is required",
    "string.maxWords": `Comment cannot exceed ${COMMENT_MAX_WORDS} words`,
  });

export const recommendationSchemas = {
  create: Joi.object({
    text: wordLimitedText,
    tags: tagsField,
  }),

  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    tag: Joi.string().valid(...RECOMMENDATION_TAGS).optional(),
    author: mongoId.optional(),
  }),

  recommendationId: Joi.object({
    id: mongoId.required(),
  }),
};

export const commentSchemas = {
  create: Joi.object({
    text: commentText,
  }),

  /** Validates both :id (recommendation) and :cid (comment) params. */
  commentId: Joi.object({
    id: mongoId.required(),
    cid: mongoId.required(),
  }),
};

export default recommendationSchemas;
