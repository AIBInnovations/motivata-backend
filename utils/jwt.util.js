/**
 * @fileoverview JWT utility for token generation and verification
 * @module utils/jwt
 */

import jwt from "jsonwebtoken";

/**
 * JWT configuration
 * @typedef {Object} JWTConfig
 * @property {string} accessTokenSecret - Secret key for access token
 * @property {string} refreshTokenSecret - Secret key for refresh token
 * @property {string} accessTokenExpiry - Access token expiration time
 * @property {string} refreshTokenExpiry - Refresh token expiration time
 */
const config = {
  accessTokenSecret:
    process.env.JWT_ACCESS_SECRET || "access-secret-key-change-in-production",
  refreshTokenSecret:
    process.env.JWT_REFRESH_SECRET || "refresh-secret-key-change-in-production",
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || "15d",
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || "70d",
};

/**
 * Generates access and refresh tokens
 * @param {Object} payload - Token payload
 * @param {string} payload.id - User/Admin ID
 * @param {string} payload.email - User/Admin email
 * @param {string} [payload.phone] - User phone (for regular users)
 * @param {string} [payload.role] - User role (USER, SUPER_ADMIN, MANAGEMENT_STAFF) (for admins)
 * @param {string} payload.userType - Type of user (admin/user)
 * @returns {Object} Object containing accessToken and refreshToken
 */
export const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpiry,
  });

  const refreshToken = jwt.sign(payload, config.refreshTokenSecret, {
    expiresIn: config.refreshTokenExpiry,
  });

  return { accessToken, refreshToken };
};

/**
 * Verifies an access token
 * @param {string} token - JWT access token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.accessTokenSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Verifies a refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.refreshTokenSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Generates a new access token from refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Object|null} Object containing new accessToken or null if invalid
 */
export const refreshAccessToken = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return null;
  }

  // Remove exp and iat from the payload
  const { exp, iat, ...payload } = decoded;

  const accessToken = jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpiry,
  });

  return { accessToken };
};

/**
 * Decodes a token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

export default {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  decodeToken,
};
