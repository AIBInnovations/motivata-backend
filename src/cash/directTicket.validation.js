/**
 * @fileoverview Validation schemas for direct ticket endpoints
 * @module validation/directTicket
 */

import Joi from "joi";

const mongoId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
  });

const phone = Joi.string()
  .pattern(/^[0-9]{10,15}$/)
  .messages({
    "string.pattern.base": "Phone number must be 10-15 digits",
  });

const name = Joi.string().trim().min(2).max(100).messages({
  "string.min": "Name must be at least 2 characters",
  "string.max": "Name cannot exceed 100 characters",
});

/**
 * Direct ticket validation schemas
 */
export const directTicketSchemas = {
  /**
   * Single direct ticket schema
   */
  single: Joi.object({
    eventId: mongoId.required().messages({
      "any.required": "Event ID is required",
    }),
    phone: phone.required().messages({
      "any.required": "Phone number is required",
    }),
    name: name.required().messages({
      "any.required": "Name is required",
    }),
    priceCharged: Joi.number().min(0).optional().messages({
      "number.min": "Price cannot be negative",
    }),
    notes: Joi.string().trim().max(500).optional().messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
  }),

  /**
   * Bulk direct ticket schema
   * Note: file is handled by multer, not Joi
   */
  bulk: Joi.object({
    eventId: mongoId.required().messages({
      "any.required": "Event ID is required",
    }),
    priceCharged: Joi.number().min(0).optional().messages({
      "number.min": "Price cannot be negative",
    }),
    notes: Joi.string().trim().max(500).optional().messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
  }),
};

export default directTicketSchemas;
