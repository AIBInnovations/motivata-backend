import Joi from "joi";
import { REWARD_TYPES, REWARD_TRIGGERS } from "./challengeReward.schema.js";

const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

const mongoId = Joi.string().regex(mongoIdPattern).messages({
  "string.pattern.base": "Invalid ID format",
});

const baseFields = {
  title: Joi.string().trim().max(200).messages({
    "string.max": "Title cannot exceed 200 characters",
  }),
  description: Joi.string().trim().max(1000).allow("").messages({
    "string.max": "Description cannot exceed 1000 characters",
  }),
  rewardType: Joi.string()
    .valid(...REWARD_TYPES)
    .messages({ "any.only": `rewardType must be one of: ${REWARD_TYPES.join(", ")}` }),
  rewardValue: Joi.string().trim().max(200).allow(""),
  trigger: Joi.string()
    .valid(...REWARD_TRIGGERS)
    .messages({ "any.only": `trigger must be one of: ${REWARD_TRIGGERS.join(", ")}` }),
  triggerValue: Joi.number().integer().min(1).max(365),
  expiresAt: Joi.date().allow(null),
  maxClaims: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
};

export const challengeRewardSchemas = {
  create: Joi.object({
    challengeId: mongoId.required(),
    title: baseFields.title.required().messages({
      "string.empty": "Reward title is required",
      "string.max": "Title cannot exceed 200 characters",
    }),
    description: baseFields.description.optional(),
    rewardType: baseFields.rewardType.required(),
    rewardValue: baseFields.rewardValue.optional(),
    trigger: baseFields.trigger.required(),
    triggerValue: baseFields.triggerValue.default(1),
    expiresAt: baseFields.expiresAt.optional(),
    maxClaims: baseFields.maxClaims.default(0),
    isActive: baseFields.isActive.default(true),
  }),

  update: Joi.object(baseFields).min(1),

  list: Joi.object({
    challengeId: mongoId.optional(),
    isActive: Joi.boolean().optional(),
  }),

  rewardId: Joi.object({
    rewardId: mongoId.required(),
  }),

  challengeId: Joi.object({
    challengeId: mongoId.required(),
  }),

  code: Joi.object({
    code: Joi.string().trim().max(64).required().messages({
      "string.empty": "Redemption code is required",
    }),
  }),
};

export default challengeRewardSchemas;
