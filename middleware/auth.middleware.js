/**
 * @fileoverview Authentication middleware for route protection
 * @module middleware/auth
 */

import { verifyAccessToken } from '../utils/jwt.util.js';
import responseUtil from '../utils/response.util.js';

/**
 * Authenticates JWT token from request header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return responseUtil.unauthorized(res, 'No token provided');
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return responseUtil.unauthorized(res, 'Invalid or expired token');
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return responseUtil.internalError(res, 'Authentication failed', error.message);
  }
};

/**
 * Checks if authenticated user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return responseUtil.unauthorized(res, 'User not authenticated');
    }

    if (req.user.userType !== 'admin') {
      return responseUtil.forbidden(res, 'Admin access required');
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return responseUtil.internalError(res, 'Authorization failed', error.message);
  }
};

/**
 * Checks if authenticated user is a super admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export const isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return responseUtil.unauthorized(res, 'User not authenticated');
    }

    if (req.user.userType !== 'admin' || req.user.role !== 'SUPER_ADMIN') {
      return responseUtil.forbidden(res, 'Super Admin access required');
    }

    next();
  } catch (error) {
    console.error('Super Admin check error:', error);
    return responseUtil.internalError(res, 'Authorization failed', error.message);
  }
};

/**
 * Checks if authenticated user has specific access permissions
 * @param {string[]} requiredAccess - Array of required access permissions
 * @returns {Function} Middleware function
 */
export const hasAccess = (requiredAccess) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return responseUtil.unauthorized(res, 'User not authenticated');
      }

      // Super admin has all access
      if (req.user.userType === 'admin' && req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if user has required access
      const userAccess = req.user.access || [];
      const hasRequiredAccess = requiredAccess.some(access => userAccess.includes(access));

      if (!hasRequiredAccess) {
        return responseUtil.forbidden(res, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      console.error('Access check error:', error);
      return responseUtil.internalError(res, 'Authorization failed', error.message);
    }
  };
};

/**
 * Optional authentication - attaches user if token exists but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);

      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue even if there's an error
  }
};

export default {
  authenticate,
  isAdmin,
  isSuperAdmin,
  hasAccess,
  optionalAuth
};