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

  /**
   * Username validation
   */
  username: Joi.string().trim().lowercase().min(3).max(50).pattern(/^[a-z0-9_]+$/).messages({
    "string.min": "Username must be at least 3 characters",
    "string.max": "Username cannot exceed 50 characters",
    "string.pattern.base": "Username can only contain lowercase letters, numbers, and underscores",
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
    username: schemas.username.required(),
    email: schemas.email.optional().allow(null, ""),
    phone: schemas.phone.optional().allow(null, ""),
    password: schemas.password.required(),
    role: Joi.string().valid("ADMIN", "SUPER_ADMIN", "MANAGEMENT_STAFF").optional(),
    access: Joi.array().items(Joi.string()).optional(),
    allowedEvents: Joi.array().items(schemas.mongoId).optional(),
    maxCashTicketsAllowed: Joi.number().integer().min(0).optional(),
  }),

  /**
   * Admin login schema
   */
  login: Joi.object({
    username: schemas.username.required(),
    password: Joi.string().required(),
  }),

  /**
   * Admin update schema
   */
  update: Joi.object({
    name: schemas.name.optional(),
    username: schemas.username.optional(),
    email: schemas.email.optional().allow(null, ""),
    phone: schemas.phone.optional().allow(null, ""),
    role: Joi.string().valid("ADMIN", "SUPER_ADMIN", "MANAGEMENT_STAFF").optional(),
    access: Joi.array().items(Joi.string()).optional(),
    allowedEvents: Joi.array().items(schemas.mongoId).optional(),
    maxCashTicketsAllowed: Joi.number().integer().min(0).optional(),
    status: Joi.string().valid("ACTIVATED", "DEACTIVATED").optional(),
  }),

  /**
   * Update allowed events schema
   */
  updateAllowedEvents: Joi.object({
    allowedEvents: Joi.array().items(schemas.mongoId).required(),
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
   * Email is optional - users can register with just phone number
   */
  register: Joi.object({
    name: schemas.name.required(),
    email: schemas.email.optional().allow(null, ""),
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
          ticketQuantity: Joi.number().integer().min(1).default(1).optional(),
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
          ticketQuantity: Joi.number().integer().min(1).default(1).optional(),
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

/**
 * Voucher validation schemas
 */
export const voucherSchemas = {
  /**
   * Create voucher schema
   */
  create: Joi.object({
    title: Joi.string().trim().max(200).required(),
    description: Joi.string().trim().max(1000).required(),
    code: Joi.string().trim().uppercase().min(3).max(50).required(),
    maxUsage: Joi.number().integer().min(1).required(),
    events: Joi.array().items(schemas.mongoId).optional(),
    isActive: Joi.boolean().default(true),
  }),

  /**
   * Update voucher schema
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).optional(),
    description: Joi.string().trim().max(1000).optional(),
    code: Joi.string().trim().uppercase().min(3).max(50).optional(),
    maxUsage: Joi.number().integer().min(1).optional(),
    events: Joi.array().items(schemas.mongoId).optional(),
    isActive: Joi.boolean().optional(),
  }),

  /**
   * Check availability schema
   */
  checkAvailability: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    phones: Joi.array()
      .items(schemas.phone)
      .min(1)
      .required()
      .messages({
        "array.min": "At least one phone number is required",
      }),
    eventId: schemas.mongoId.optional(),
  }),

  /**
   * Query parameters for listing vouchers
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("code", "title", "usageCount", "maxUsage", "createdAt")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    isActive: Joi.boolean().optional(),
    search: Joi.string().trim().optional(),
  }),

  /**
   * Voucher ID parameter validation
   */
  voucherId: Joi.object({
    id: schemas.mongoId.required(),
  }),
};

/**
 * Offline Cash validation schemas
 */
export const offlineCashSchemas = {
  /**
   * Create offline cash schema
   * Admin only inputs: phone, ticketCount, eventId, optional price/notes
   */
  create: Joi.object({
    eventId: schemas.mongoId.required(),
    phone: schemas.phone.required(),
    ticketCount: Joi.number().integer().min(1).required(),
    priceCharged: Joi.number().min(0).optional(),
    notes: Joi.string().trim().max(500).optional(),
  }),

  /**
   * Query parameters for listing offline cash records
   */
  list: Joi.object({
    eventId: schemas.mongoId.optional(),
    redeemed: Joi.string().valid("true", "false").optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  /**
   * ID parameter validation
   */
  id: Joi.object({
    id: schemas.mongoId.required(),
  }),

  /**
   * Event ID parameter validation
   */
  eventId: Joi.object({
    eventId: schemas.mongoId.required(),
  }),

  /**
   * Enrollment list query parameters
   */
  enrollmentList: Joi.object({
    status: Joi.string().valid("ACTIVE", "CANCELLED", "REFUNDED").optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  /**
   * Validate redemption link query params
   */
  validateLink: Joi.object({
    phone: schemas.phone.required(),
    sign: Joi.string().length(6).pattern(/^[a-z0-9]+$/).required().messages({
      "string.length": "Signature must be 6 characters",
      "string.pattern.base": "Invalid signature format",
    }),
  }),

  /**
   * Redeem tickets schema
   */
  redeem: Joi.object({
    offlineCashId: schemas.mongoId.required(),
    attendees: Joi.array()
      .items(
        Joi.object({
          name: schemas.name.required(),
          phone: schemas.phone.required(),
        })
      )
      .min(1)
      .required(),
    voucherCode: Joi.string().trim().uppercase().optional(),
  }),

  /**
   * Scan ticket query params
   */
  scanTicket: Joi.object({
    enrollmentId: schemas.mongoId.required(),
    userId: schemas.mongoId.optional(),
    eventId: schemas.mongoId.required(),
    phone: schemas.phone.required(),
  }),
};

/**
 * Session validation schemas
 */
export const sessionSchemas = {
  /**
   * Create session schema
   */
  create: Joi.object({
    title: Joi.string().trim().max(200).required().messages({
      "string.empty": "Session title is required",
      "string.max": "Session title cannot exceed 200 characters",
    }),
    shortDescription: Joi.string().trim().max(500).required().messages({
      "string.empty": "Short description is required",
      "string.max": "Short description cannot exceed 500 characters",
    }),
    longDescription: Joi.string().max(5000).required().messages({
      "string.empty": "Long description is required",
      "string.max": "Long description cannot exceed 5000 characters",
    }),
    price: Joi.number().min(0).required().messages({
      "number.base": "Price must be a number",
      "number.min": "Price cannot be negative",
      "any.required": "Session price is required",
    }),
    compareAtPrice: Joi.number().min(0).optional().messages({
      "number.base": "Compare at price must be a number",
      "number.min": "Compare at price cannot be negative",
    }),
    duration: Joi.number().integer().min(1).max(480).required().messages({
      "number.base": "Duration must be a number",
      "number.min": "Duration must be at least 1 minute",
      "number.max": "Duration cannot exceed 480 minutes (8 hours)",
      "any.required": "Session duration is required",
    }),
    sessionType: Joi.string().valid("OTO", "OTM").required().messages({
      "any.only": "Session type must be OTO (One-to-One) or OTM (One-to-Many)",
      "any.required": "Session type is required",
    }),
    host: Joi.string().trim().max(100).required().messages({
      "string.empty": "Host name is required",
      "string.max": "Host name cannot exceed 100 characters",
    }),
    availableSlots: Joi.number().integer().min(0).optional().messages({
      "number.base": "Available slots must be a number",
      "number.min": "Available slots cannot be negative",
    }),
    calendlyLink: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid Calendly URL",
    }),
    sessionDate: Joi.date().iso().optional().allow(null).messages({
      "date.base": "Please provide a valid session date",
    }),
    imageUrl: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid image URL",
    }),
    isLive: Joi.boolean().optional().default(true),
  }),

  /**
   * Update session schema
   */
  update: Joi.object({
    title: Joi.string().trim().max(200).optional().messages({
      "string.max": "Session title cannot exceed 200 characters",
    }),
    shortDescription: Joi.string().trim().max(500).optional().messages({
      "string.max": "Short description cannot exceed 500 characters",
    }),
    longDescription: Joi.string().max(5000).optional().messages({
      "string.max": "Long description cannot exceed 5000 characters",
    }),
    price: Joi.number().min(0).optional().messages({
      "number.base": "Price must be a number",
      "number.min": "Price cannot be negative",
    }),
    compareAtPrice: Joi.number().min(0).optional().allow(null).messages({
      "number.base": "Compare at price must be a number",
      "number.min": "Compare at price cannot be negative",
    }),
    duration: Joi.number().integer().min(1).max(480).optional().messages({
      "number.base": "Duration must be a number",
      "number.min": "Duration must be at least 1 minute",
      "number.max": "Duration cannot exceed 480 minutes (8 hours)",
    }),
    sessionType: Joi.string().valid("OTO", "OTM").optional().messages({
      "any.only": "Session type must be OTO (One-to-One) or OTM (One-to-Many)",
    }),
    host: Joi.string().trim().max(100).optional().messages({
      "string.max": "Host name cannot exceed 100 characters",
    }),
    availableSlots: Joi.number().integer().min(0).optional().allow(null).messages({
      "number.base": "Available slots must be a number",
      "number.min": "Available slots cannot be negative",
    }),
    calendlyLink: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid Calendly URL",
    }),
    sessionDate: Joi.date().iso().optional().allow(null).messages({
      "date.base": "Please provide a valid session date",
    }),
    imageUrl: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Please provide a valid image URL",
    }),
    isLive: Joi.boolean().optional(),
  }),

  /**
   * Query parameters for listing sessions
   */
  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("title", "price", "duration", "sessionDate", "createdAt", "host")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    sessionType: Joi.string().valid("OTO", "OTM").optional(),
    isLive: Joi.boolean().optional(),
    host: Joi.string().trim().optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    minDuration: Joi.number().integer().min(1).optional(),
    maxDuration: Joi.number().integer().min(1).optional(),
    search: Joi.string().trim().optional(),
  }),

  /**
   * Session ID parameter validation
   */
  sessionId: Joi.object({
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
  voucherSchemas,
  offlineCashSchemas,
  sessionSchemas,
};
