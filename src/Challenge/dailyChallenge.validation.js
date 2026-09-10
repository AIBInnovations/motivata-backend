import Joi from "joi";
import { ICON_KEYS } from "./challenge.icons.js";

const mongoIdPattern = /^[0-9a-fA-F]{24}$/;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

const mongoId = Joi.string().regex(mongoIdPattern).messages({
  "string.pattern.base": "Invalid ID format",
});

const dateKey = Joi.string().regex(dateKeyPattern).messages({
  "string.pattern.base": "Date must be in YYYY-MM-DD format",
});

const iconField = Joi.string()
  .valid(...ICON_KEYS)
  .optional()
  .allow(null, "")
  .messages({
    "any.only": `icon must be one of: ${ICON_KEYS.join(", ")}`,
  });

const entryFields = {
  challengeId: mongoId.optional().allow(null, ""),
  title: Joi.string().trim().max(200).optional().allow("").messages({
    "string.max": "Title cannot exceed 200 characters",
  }),
  description: Joi.string().trim().max(2000).optional().allow("").messages({
    "string.max": "Description cannot exceed 2000 characters",
  }),
  icon: iconField,
  isActive: Joi.boolean().optional(),
};

const requireChallengeOrTitle = (value, helpers) => {
  if (!value.challengeId && !value.title) {
    return helpers.error("any.custom", { message: "Either challengeId or title is required" });
  }
  return value;
};

export const dailyChallengeSchemas = {
  create: Joi.object({
    dateKey: dateKey.required(),
    ...entryFields,
  })
    .custom(requireChallengeOrTitle)
    .messages({
      "any.custom": "Either challengeId or title is required",
    }),

  bulk: Joi.object({
    overwrite: Joi.boolean().default(false),
    entries: Joi.array()
      .min(1)
      .max(400)
      .items(
        Joi.object({
          dateKey: dateKey.required(),
          ...entryFields,
        })
          .custom(requireChallengeOrTitle)
          .messages({
            "any.custom": "Either challengeId or title is required",
          })
      )
      .required()
      .messages({
        "array.min": "At least one entry is required",
        "array.max": "Cannot schedule more than 400 dates in one request",
      }),
  }),

  update: Joi.object(entryFields).min(1),

  list: Joi.object({
    from: dateKey.optional(),
    to: dateKey.optional(),
  }),

  dailyChallengeId: Joi.object({
    dailyChallengeId: mongoId.required(),
  }),
};

export default dailyChallengeSchemas;
