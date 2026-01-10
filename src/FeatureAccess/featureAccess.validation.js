/**
 * @fileoverview Validation schemas for feature access
 * @module validation/featureAccess
 */

import Joi from 'joi';

/**
 * Feature access validation schemas
 */
export const featureAccessSchemas = {
  /**
   * Update feature access schema
   */
  update: Joi.object({
    featureKey: Joi.string()
      .trim()
      .uppercase()
      .valid('SOS', 'CONNECT', 'CHALLENGE')
      .required()
      .messages({
        'any.required': 'Feature key is required',
        'any.only': 'Feature key must be one of: SOS, CONNECT, CHALLENGE',
      }),
    requiresMembership: Joi.boolean().optional().messages({
      'boolean.base': 'requiresMembership must be a boolean',
    }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'isActive must be a boolean',
    }),
  }),

  /**
   * Check feature access schema
   */
  check: Joi.object({
    featureKey: Joi.string()
      .trim()
      .uppercase()
      .valid('SOS', 'CONNECT', 'CHALLENGE')
      .required()
      .messages({
        'any.required': 'Feature key is required',
        'any.only': 'Feature key must be one of: SOS, CONNECT, CHALLENGE',
      }),
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9]{10,15}$/)
      .required()
      .messages({
        'any.required': 'Phone number is required',
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
  }),
};
