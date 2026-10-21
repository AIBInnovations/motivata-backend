import Joi from "joi";
import { CONTENT_CATEGORIES, CONTENT_MAX_WORDS, countContentWords } from "./content.constants.js";

const mongoId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "Invalid ID format" });

const LINK_PATTERN = /^https?:\/\/\S+$/i;

export const adminPostSchemas = {
  update: Joi.object({
    title: Joi.string().trim().min(1).max(200).messages({
      "string.empty": "Title is required",
      "string.max": "Title cannot exceed 200 characters",
    }),
    subHeading: Joi.string().trim().max(200).allow("").messages({
      "string.max": "Sub-heading cannot exceed 200 characters",
    }),
    category: Joi.string()
      .trim()
      .valid(...CONTENT_CATEGORIES, "")
      .messages({ "any.only": "Choose a valid category" }),
    content: Joi.string()
      .trim()
      .max(5000)
      .allow("")
      .custom((value, helpers) =>
        countContentWords(value) > CONTENT_MAX_WORDS ? helpers.error("string.maxWords") : value
      )
      .messages({ "string.maxWords": `Text cannot exceed ${CONTENT_MAX_WORDS} words` }),
    caption: Joi.string().trim().max(2000).allow("").messages({
      "string.max": "Caption cannot exceed 2000 characters",
    }),
    videoUrl: Joi.string().trim().pattern(LINK_PATTERN).allow("").messages({
      "string.pattern.base": "Video link must start with http:// or https://",
    }),
    linkUrl: Joi.string().trim().pattern(LINK_PATTERN).allow("").messages({
      "string.pattern.base": "Link must start with http:// or https://",
    }),
    mediaUrls: Joi.array().items(Joi.string().uri()).min(1).max(10).messages({
      "array.min": "At least one photo URL is required",
      "array.max": "Cannot have more than 10 photos",
    }),
    mediaThumbnail: Joi.string().uri().allow(null, ""),
  })
    .min(1)
    .messages({ "object.min": "Send at least one field to update" }),

  postId: Joi.object({
    postId: mongoId.required(),
  }),

  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().max(100).allow("").optional(),
  }),
};

export default adminPostSchemas;
