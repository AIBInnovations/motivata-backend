/**
 * @fileoverview Validation schemas for feature requests
 * @module validation/featureRequest
 */

import Joi from 'joi';

/**
 * Feature request validation schemas
 */
export const featureRequestSchemas = {
  /**
   * Submit feature request schema (public)
   */
  submit: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9]{10,15}$/)
      .required()
      .messages({
        'any.required': 'Phone number is required',
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'any.required': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
      }),
    requestedFeatures: Joi.array()
      .items(
        Joi.alternatives().try(
          Joi.string().uppercase().valid('SOS', 'CONNECT', 'CHALLENGE'),
          Joi.object({
            featureKey: Joi.string().uppercase().valid('SOS', 'CONNECT', 'CHALLENGE').required(),
          })
        )
      )
      .min(1)
      .messages({
        'array.min': 'Please select at least one feature',
        'any.only': 'Feature must be one of: SOS, CONNECT, CHALLENGE',
      }),
    bundleId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid bundle ID format',
      }),
    couponCode: Joi.string()
      .trim()
      .uppercase()
      .optional()
      .messages({
        'string.base': 'Coupon code must be a string',
      }),
  }).or('requestedFeatures', 'bundleId').messages({
    'object.missing': 'Please select at least one feature or a bundle',
  }),

  /**
   * Withdraw feature request schema (public)
   */
  withdraw: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9]{10,15}$/)
      .required()
      .messages({
        'any.required': 'Phone number is required for verification',
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
  }),

  /**
   * Approve feature request schema (admin)
   */
  approve: Joi.object({
    features: Joi.array()
      .items(Joi.string().uppercase().valid('SOS', 'CONNECT', 'CHALLENGE'))
      .optional()
      .messages({
        'any.only': 'Feature must be one of: SOS, CONNECT, CHALLENGE',
      }),
    paymentAmount: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Payment amount cannot be negative',
      }),
    durationInDays: Joi.number()
      .integer()
      .min(0)
      .allow(null)
      .optional()
      .messages({
        'number.min': 'Duration must be 0 or positive',
        'number.integer': 'Duration must be a whole number',
      }),
    adminNotes: Joi.string()
      .trim()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Admin notes cannot exceed 1000 characters',
      }),
    sendWhatsApp: Joi.boolean()
      .optional()
      .default(true),
    couponCode: Joi.string()
      .trim()
      .uppercase()
      .optional(),
  }),

  /**
   * Reject feature request schema (admin)
   */
  reject: Joi.object({
    rejectionReason: Joi.string()
      .trim()
      .min(1)
      .max(500)
      .required()
      .messages({
        'any.required': 'Rejection reason is required',
        'string.min': 'Rejection reason cannot be empty',
        'string.max': 'Rejection reason cannot exceed 500 characters',
      }),
    adminNotes: Joi.string()
      .trim()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Admin notes cannot exceed 1000 characters',
      }),
  }),

  /**
   * List feature requests query schema (admin)
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string()
      .uppercase()
      .valid('PENDING', 'APPROVED', 'REJECTED', 'PAYMENT_SENT', 'COMPLETED')
      .optional(),
    featureKey: Joi.string()
      .uppercase()
      .valid('SOS', 'CONNECT', 'CHALLENGE')
      .optional(),
    search: Joi.string().trim().optional(),
    sortBy: Joi.string()
      .valid('createdAt', 'updatedAt', 'name', 'phone', 'status')
      .default('createdAt'),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc'),
  }),
};

/**
 * Feature pricing validation schemas
 */
export const featurePricingSchemas = {
  /**
   * Create feature pricing schema
   */
  create: Joi.object({
    featureKey: Joi.string()
      .trim()
      .uppercase()
      .max(50)
      .required()
      .messages({
        'any.required': 'Feature key is required',
        'string.max': 'Feature key cannot exceed 50 characters',
      }),
    name: Joi.string()
      .trim()
      .max(200)
      .required()
      .messages({
        'any.required': 'Name is required',
        'string.max': 'Name cannot exceed 200 characters',
      }),
    description: Joi.string()
      .trim()
      .max(2000)
      .optional()
      .default(''),
    price: Joi.number()
      .min(0)
      .required()
      .messages({
        'any.required': 'Price is required',
        'number.min': 'Price must be a positive number',
      }),
    compareAtPrice: Joi.number()
      .min(0)
      .optional()
      .allow(null),
    durationInDays: Joi.number()
      .integer()
      .min(0)
      .optional()
      .allow(null),
    isBundle: Joi.boolean()
      .optional()
      .default(false),
    includedFeatures: Joi.array()
      .items(Joi.string().uppercase().valid('SOS', 'CONNECT', 'CHALLENGE'))
      .optional()
      .default([]),
    perks: Joi.array()
      .items(Joi.string().trim().max(500))
      .optional()
      .default([]),
    displayOrder: Joi.number()
      .integer()
      .optional()
      .default(0),
    isFeatured: Joi.boolean()
      .optional()
      .default(false),
    isActive: Joi.boolean()
      .optional()
      .default(true),
  }),

  /**
   * Update feature pricing schema
   */
  update: Joi.object({
    name: Joi.string()
      .trim()
      .max(200)
      .optional(),
    description: Joi.string()
      .trim()
      .max(2000)
      .optional(),
    price: Joi.number()
      .min(0)
      .optional(),
    compareAtPrice: Joi.number()
      .min(0)
      .optional()
      .allow(null),
    durationInDays: Joi.number()
      .integer()
      .min(0)
      .optional()
      .allow(null),
    isBundle: Joi.boolean()
      .optional(),
    includedFeatures: Joi.array()
      .items(Joi.string().uppercase().valid('SOS', 'CONNECT', 'CHALLENGE'))
      .optional(),
    perks: Joi.array()
      .items(Joi.string().trim().max(500))
      .optional(),
    displayOrder: Joi.number()
      .integer()
      .optional(),
    isFeatured: Joi.boolean()
      .optional(),
    isActive: Joi.boolean()
      .optional(),
  }),
};

export default {
  featureRequestSchemas,
  featurePricingSchemas,
};
