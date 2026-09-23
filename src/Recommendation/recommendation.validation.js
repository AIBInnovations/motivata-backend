/**
 * @fileoverview Joi validation schemas for the Recommendation feature.
 * @module Recommendation/validation
 */

import Joi from "joi";
import {
  RECOMMENDATION_TAGS,
  RECOMMENDATION_MAIN_TAGS,
  RECOMMENDATION_CATEGORIES,
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
  .custom((value, helpers) => {
    const main = value[0];
    if (!RECOMMENDATION_MAIN_TAGS.includes(main)) return helpers.error("tags.main");
    if (value.length > 1) {
      const category = RECOMMENDATION_CATEGORIES.find((c) => c.name === main);
      if (!category || !category.tags.includes(value[1])) return helpers.error("tags.sub");
    }
    return value;
  })
  .messages({
    "tags.main": "Choose one main category first",
    "tags.sub": "Choose a sub-tag from the selected category",
    "array.min": "Select at least one tag",
    "array.max": "Select one main category and at most one sub-tag",
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
    url: Joi.string()
      .trim()
      .max(500)
      .pattern(/^https?:\/\/\S+$/i)
      .allow("", null)
      .optional()
      .messages({ "string.pattern.base": "Link must start with http:// or https://" }),
  }),

  similar: Joi.object({
    text: Joi.string().trim().max(2000).required(),
    tags: Joi.array().items(Joi.string()).max(5).optional(),
    url: Joi.string().trim().max(500).allow("", null).optional(),
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
