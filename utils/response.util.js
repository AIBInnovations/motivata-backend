/**
 * @fileoverview Response utility for standardized API responses
 * @module utils/response
 */

/**
 * Sends a successful response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (200, 201, etc.)
 * @param {string} message - Success message
 * @param {Object} [data={}] - Response data
 * @returns {Object} Express response
 */
const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    status: statusCode,
    message,
    error: null,
    data
  });
};

/**
 * Sends an error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 500, etc.)
 * @param {string} message - Error message
 * @param {string|Object} [error=null] - Error details
 * @returns {Object} Express response
 */
const sendError = (res, statusCode, message, error = null) => {
  return res.status(statusCode).json({
    status: statusCode,
    message,
    error: error || message,
    data: null
  });
};

/**
 * Common success responses
 */
const responseUtil = {
  // Success responses
  success: (res, message = "Success", data = {}) =>
    sendSuccess(res, 200, message, data),

  created: (res, message = "Resource created successfully", data = {}) =>
    sendSuccess(res, 201, message, data),

  // Error responses
  badRequest: (res, message = "Bad request", error = null) =>
    sendError(res, 400, message, error),

  unauthorized: (res, message = "Unauthorized access", error = null) =>
    sendError(res, 401, message, error),

  forbidden: (res, message = "Forbidden", error = null) =>
    sendError(res, 403, message, error),

  notFound: (res, message = "Resource not found", error = null) =>
    sendError(res, 404, message, error),

  conflict: (res, message = "Conflict", error = null) =>
    sendError(res, 409, message, error),

  validationError: (res, message = "Validation error", error = null) =>
    sendError(res, 422, message, error),

  internalError: (res, message = "Internal server error", error = null) =>
    sendError(res, 500, message, error),

  serviceUnavailable: (res, message = "Service unavailable", error = null) =>
    sendError(res, 503, message, error),

  // Custom response
  custom: (res, statusCode, message, data = null, error = null) => {
    return res.status(statusCode).json({
      status: statusCode,
      message,
      error,
      data
    });
  }
};

export default responseUtil;