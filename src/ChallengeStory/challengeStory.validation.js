/**
 * @fileoverview ChallengeStory validation schemas using Joi
 * @module validation/challengeStory
 */

import Joi from "joi";

const mongoIdPattern = /^[0-9a-fA-F]{24}$/;
const mongoId = Joi.string().regex(mongoIdPattern).messages({
  "string.pattern.base": "Invalid ID format",
});

/**
 * ChallengeStory validation schemas
 */
export const challengeStorySchemas = {
  /**
   * Create challenge story validation
   */
  create: Joi.object({
    mediaType: Joi.string()
      .valid("image", "video", "text")
      .required()
      .messages({
        "any.required": "Media type is required",
        "any.only": "Media type must be image, video, or text",
      }),
    mediaUrl: Joi.when("mediaType", [
      {
        is: "image",
        then: Joi.string().uri().required().messages({
          "any.required": "Media URL is required for image stories",
          "string.uri": "Please provide a valid media URL",
        }),
      },
      {
        is: "video",
        then: Joi.string().uri().required().messages({
          "any.required": "Media URL is required for video stories",
          "string.uri": "Please provide a valid media URL",
        }),
      },
      {
        is: "text",
        then: Joi.string().uri().optional().allow(null, ""),
      },
    ]),
    cloudinaryPublicId: Joi.string().trim().optional().allow(null, ""),
    caption: Joi.when("mediaType", {
      is: "text",
      then: Joi.string().trim().min(1).max(500).required().messages({
        "any.required": "Caption is required for text stories",
        "string.empty": "Caption is required for text stories",
        "string.min": "Caption is required for text stories",
        "string.max": "Caption cannot exceed 500 characters",
      }),
      otherwise: Joi.string().trim().max(500).optional().allow(null, ""),
    }),
    backgroundColor: Joi.when("mediaType", {
      is: "text",
      then: Joi.string().trim().optional().default("#8B5CF6"),
      otherwise: Joi.string().trim().optional().allow(null, ""),
    }),
  }),

  /**
   * Challenge ID param validation
   */
  challengeIdParam: Joi.object({
    challengeId: mongoId.required().messages({
      "any.required": "Challenge ID is required",
      "string.pattern.base": "Invalid challenge ID format",
    }),
  }),

  /**
   * Story ID param validation
   */
  storyIdParam: Joi.object({
    storyId: mongoId.required().messages({
      "any.required": "Story ID is required",
      "string.pattern.base": "Invalid story ID format",
    }),
  }),
};

export default challengeStorySchemas;
