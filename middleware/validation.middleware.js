/**
 * @fileoverview Validation middleware for request input validation
 * @module middleware/validation
 */

import Joi from "joi";
import responseUtil from "../utils/response.util.js";

/**
 * Validates request body against a Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    req.body = value;
    next();
  };
};

/**
 * Validates request params against a Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return responseUtil.validationError(res, "Invalid parameters", errors);
    }

    // Clear existing params and assign validated values
    for (const key in req.params) {
      delete req.params[key];
    }
    Object.assign(req.params, value);
    next();
  };
};

/**
 * Validates request query against a Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return responseUtil.validationError(
        res,
        "Invalid query parameters",
        errors
      );
    }

    // Clear existing query params and assign validated values
    for (const key in req.query) {
      delete req.query[key];
    }
    Object.assign(req.query, value);
    next();
  };
};

/**
 * Common validation schemas
 */
export const schemas = {
  /**
   * MongoDB ObjectId validation
   */
  mongoId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid ID format",
    }),

  /**
   * Email validation
   */
  email: Joi.string().email().lowercase().trim().messages({
    "string.email": "Invalid email format",
  }),

  /**
   * Phone validation
   */
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .messages({
      "string.pattern.base": "Phone number must be 10-15 digits",
    }),

  /**
   * Password validation
   */
  password: Joi.string().min(8).messages({
    "string.min": "Password must be at least 8 characters",
  }),
  // password: Joi.string().min(8).pattern(
  //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  // ).messages({
  //   'string.min': 'Password must be at least 8 characters',
  //   'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character'
  // }),

  /**
   * Name validation
   */
  name: Joi.string().trim().min(2).max(100).messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 100 characters",
  }),
};

/**
 * Admin validation schemas
 */
export const adminSchemas = {
  /**
   * Admin registration schema
   */
  register: Joi.object({
    name: schemas.name.required(),
    email: schemas.email.required(),
    phone: schemas.phone.required(),
    password: schemas.password.required(),
    role: Joi.string().valid("SUPER_ADMIN", "MANAGEMENT_STAFF").optional(),
    access: Joi.array().items(Joi.string()).optional(),
  }),

  /**
   * Admin login schema
   */
  login: Joi.object({
    email: schemas.email.required(),
    password: Joi.string().required(),
  }),

  /**
   * Admin update schema
   */
  update: Joi.object({
    name: schemas.name.optional(),
    email: schemas.email.optional(),
    phone: schemas.phone.optional(),
    role: Joi.string().valid("SUPER_ADMIN", "MANAGEMENT_STAFF").optional(),
    access: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid("ACTIVATED", "DEACTIVATED").optional(),
  }),

  /**
   * Change password schema
   */
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: schemas.password.required(),
  }),

  /**
   * Refresh token schema
   */
  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

/**
 * User validation schemas
 */
export const userSchemas = {
  /**
   * User registration schema
   */
  register: Joi.object({
    name: schemas.name.required(),
    email: schemas.email.required(),
    phone: schemas.phone.required(),
    password: schemas.password.required(),
  }),

  /**
   * User login schema (email)
   */
  login: Joi.object({
    email: schemas.email.required(),
    password: Joi.string().required(),
  }),

  /**
   * User login schema (phone)
   */
  loginWithPhone: Joi.object({
    phone: schemas.phone.required(),
    password: Joi.string().required(),
  }),

  /**
   * Check phone exists schema
   */
  checkPhone: Joi.object({
    phone: schemas.phone.required(),
  }),

  /**
   * User update schema
   */
  update: Joi.object({
    name: schemas.name.optional(),
    email: schemas.email.optional(),
    phone: schemas.phone.optional(),
  }),

  /**
   * Change password schema
   */
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: schemas.password.required(),
  }),

  /**
   * Refresh token schema
   */
  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

/**
 * Event validation schemas
 */
export const eventSchemas = {
  /**
   * Create event schema
   */
  create: Joi.object({
    name: Joi.string().trim().max(200).required(),
    description: Joi.string().max(5000).required(),
    imageUrls: Joi.array().items(Joi.string().uri()).optional(),
    thumbnail: Joi.object({
      imageUrl: Joi.string().uri().optional(),
      videoUrl: Joi.string().uri().optional(),
    }).optional(),
    mode: Joi.string().valid("ONLINE", "OFFLINE", "HYBRID").required(),
    city: Joi.when("mode", {
      is: Joi.string().valid("OFFLINE", "HYBRID"),
      then: Joi.string().trim().required(),
      otherwise: Joi.string().trim().optional(),
    }),
    category: Joi.string()
      .valid(
        "TECHNOLOGY",
        "EDUCATION",
        "MEDICAL",
        "COMEDY",
        "ENTERTAINMENT",
        "BUSINESS",
        "SPORTS",
        "ARTS",
        "MUSIC",
        "FOOD",
        "LIFESTYLE",
        "OTHER"
      )
      .required(),
    startDate: Joi.date().iso().greater("now").required(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
    price: Joi.number().min(0).optional(),
    compareAtPrice: Joi.number().min(0).min(Joi.ref("price")).optional(),
    pricingTiers: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().max(100).required(),
          price: Joi.number().min(0).required(),
          compareAtPrice: Joi.number().min(0).min(Joi.ref("price")).optional(),
          shortDescription: Joi.string().trim().max(500).optional(),
          notes: Joi.string().trim().max(1000).optional(),
        })
      )
      .optional(),
    availableSeats: Joi.number().integer().min(0).optional(),
    coupons: Joi.array().items(schemas.mongoId).optional(),
  }).or("price", "pricingTiers"),

  /**
   * Update event schema
   */
  update: Joi.object({
    name: Joi.string().trim().max(200).optional(),
    description: Joi.string().max(5000).optional(),
    imageUrls: Joi.array().items(Joi.string().uri()).optional(),
    thumbnail: Joi.object({
      imageUrl: Joi.string().uri().optional(),
      videoUrl: Joi.string().uri().optional(),
    }).optional(),
    mode: Joi.string().valid("ONLINE", "OFFLINE", "HYBRID").optional(),
    city: Joi.when("mode", {
      is: Joi.string().valid("OFFLINE", "HYBRID"),
      then: Joi.string().trim().required(),
      otherwise: Joi.string().trim().optional(),
    }),
    category: Joi.string()
      .valid(
        "TECHNOLOGY",
        "EDUCATION",
        "MEDICAL",
        "COMEDY",
        "ENTERTAINMENT",
        "BUSINESS",
        "SPORTS",
        "ARTS",
        "MUSIC",
        "FOOD",
        "LIFESTYLE",
        "OTHER"
      )
      .optional(),
    startDate: Joi.date().iso().greater("now").optional(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")).optional(),
    price: Joi.number().min(0).optional(),
    compareAtPrice: Joi.number().min(0).min(Joi.ref("price")).optional(),
    pricingTiers: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().max(100).required(),
          price: Joi.number().min(0).required(),
          compareAtPrice: Joi.number().min(0).min(Joi.ref("price")).optional(),
          shortDescription: Joi.string().trim().max(500).optional(),
          notes: Joi.string().trim().max(1000).optional(),
        })
      )
      .optional(),
    availableSeats: Joi.number().integer().min(0).optional(),
    coupons: Joi.array().items(schemas.mongoId).optional(),
    isLive: Joi.boolean().optional(),
  }),

  /**
   * Query parameters for listing events
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("name", "startDate", "endDate", "price", "createdAt")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    category: Joi.string()
      .valid(
        "TECHNOLOGY",
        "EDUCATION",
        "MEDICAL",
        "COMEDY",
        "ENTERTAINMENT",
        "BUSINESS",
        "SPORTS",
        "ARTS",
        "MUSIC",
        "FOOD",
        "LIFESTYLE",
        "OTHER"
      )
      .optional(),
    mode: Joi.string().valid("ONLINE", "OFFLINE", "HYBRID").optional(),
    city: Joi.string().trim().optional(),
    isLive: Joi.boolean().optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    startDateFrom: Joi.date().iso().optional(),
    startDateTo: Joi.date().iso().optional(),
    search: Joi.string().trim().optional(),
  }),

  /**
   * Event ID parameter validation
   */
  eventId: Joi.object({
    id: schemas.mongoId.required(),
  }),
};

/**
 * Coupon validation schemas
 */
export const couponSchemas = {
  /**
   * Create coupon schema
   */
  create: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(50).required(),
    discountPercent: Joi.number().min(0).max(100).required(),
    maxDiscountAmount: Joi.number().min(0).required(),
    minPurchaseAmount: Joi.number().min(0).default(0),
    maxUsageLimit: Joi.number().integer().min(1).optional().allow(null),
    maxUsagePerUser: Joi.number().integer().min(1).default(1),
    validFrom: Joi.date().iso().required(),
    validUntil: Joi.date().iso().greater(Joi.ref("validFrom")).required(),
    description: Joi.string().trim().max(500).optional(),
    isActive: Joi.boolean().default(true),
  }),

  /**
   * Update coupon schema
   */
  update: Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(50).optional(),
    discountPercent: Joi.number().min(0).max(100).optional(),
    maxDiscountAmount: Joi.number().min(0).optional(),
    minPurchaseAmount: Joi.number().min(0).optional(),
    maxUsageLimit: Joi.number().integer().min(1).optional().allow(null),
    maxUsagePerUser: Joi.number().integer().min(1).optional(),
    validFrom: Joi.date().iso().optional(),
    validUntil: Joi.date().iso().optional(),
    description: Joi.string().trim().max(500).optional(),
    isActive: Joi.boolean().optional(),
  }),

  /**
   * Validate coupon code schema
   */
  validate: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    amount: Joi.number().min(0).required(),
  }),

  /**
   * Query parameters for listing coupons
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("code", "discountPercent", "validFrom", "validUntil", "createdAt")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().optional(),
  }),

  /**
   * Coupon ID parameter validation
   */
  couponId: Joi.object({
    id: schemas.mongoId.required(),
  }),
};

/**
 * Payment validation schemas
 */
export const paymentSchemas = {
  /**
   * Create payment order schema
   */
  createOrder: Joi.object({
    type: Joi.string().valid("EVENT", "SESSION", "OTHER", "PRODUCT").required(),
    eventId: Joi.when("type", {
      is: "EVENT",
      then: schemas.mongoId.required(),
      otherwise: Joi.optional(),
    }),
    sessionId: Joi.when("type", {
      is: "SESSION",
      then: schemas.mongoId.required(),
      otherwise: Joi.optional(),
    }),
    amount: Joi.number().min(0).required(),
    tierName: Joi.string().trim().optional(),
    couponCode: Joi.string().trim().uppercase().optional(),
    metadata: Joi.object().optional(),
  }),

  /**
   * Verify payment schema
   */
  verifyPayment: Joi.object({
    orderId: Joi.string().required(),
    paymentId: Joi.string().required(),
    signature: Joi.string().required(),
  }),

  /**
   * Query parameters for listing payments
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("purchaseDateTime", "amount", "finalAmount", "createdAt")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    status: Joi.string()
      .valid("PENDING", "SUCCESS", "FAILED", "REFUNDED")
      .optional(),
    type: Joi.string().valid("EVENT", "SESSION", "OTHER", "PRODUCT").optional(),
    eventId: schemas.mongoId.optional(),
    sessionId: schemas.mongoId.optional(),
    paymentMethod: Joi.string().valid("CASH", "RAZORPAY").optional(),
  }),

  /**
   * Payment ID parameter validation
   */
  paymentId: Joi.object({
    id: schemas.mongoId.required(),
  }),
};

/**
 * Event Enrollment validation schemas
 */
export const enrollmentSchemas = {
  /**
   * Create enrollment schema
   */
  create: Joi.object({
    paymentId: Joi.string().required(),
    phones: Joi.array()
      .items(schemas.phone)
      .min(1)
      .required()
      .messages({
        "array.min": "At least one phone number is required",
      }),
    tierName: Joi.string().trim().optional(),
  }),

  /**
   * Create mock enrollment schema (for testing without payment)
   */
  mockCreate: Joi.object({
    eventId: schemas.mongoId.required(),
    phones: Joi.array()
      .items(schemas.phone)
      .min(1)
      .required()
      .messages({
        "array.min": "At least one phone number is required",
      }),
    tierName: Joi.string().trim().optional(),
  }),

  /**
   * Query parameters for listing enrollments
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "updatedAt").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    status: Joi.string().valid("ACTIVE", "CANCELLED", "REFUNDED").optional(),
    eventId: schemas.mongoId.optional(),
  }),

  /**
   * Cancel enrollment/ticket schema
   */
  cancel: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
    phone: schemas.phone.optional(),
    cancelAll: Joi.boolean().optional(),
  }).or("phone", "cancelAll"),

  /**
   * Enrollment ID parameter validation
   */
  enrollmentId: Joi.object({
    id: schemas.mongoId.required(),
  }),
};

export default {
  validateBody,
  validateParams,
  validateQuery,
  schemas,
  adminSchemas,
  userSchemas,
  eventSchemas,
  couponSchemas,
  paymentSchemas,
  enrollmentSchemas,
};
