/**
 * @fileoverview User authentication routes
 * @module routes/user-auth
 */

import express from 'express';
import * as userAuthController from './user.auth.controller.js';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, userSchemas, schemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * Public routes (no authentication required)
 */

/**
 * @route POST /api/app/auth/register
 * @description Register new user
 * @body {string} name - User name
 * @body {string} email - User email
 * @body {string} phone - User phone
 * @body {string} password - User password
 * @returns {Object} User data and tokens
 */
router.post('/register',
  validateBody(userSchemas.register),
  userAuthController.register
);

/**
 * @route POST /api/app/auth/login
 * @description User login with email
 * @body {string} email - User email
 * @body {string} password - User password
 * @returns {Object} User data and tokens
 */
router.post('/login',
  validateBody(userSchemas.login),
  userAuthController.login
);

/**
 * @route POST /api/app/auth/login-phone
 * @description User login with phone number
 * @body {string} phone - User phone number
 * @body {string} password - User password
 * @returns {Object} User data and tokens
 */
router.post('/login-phone',
  validateBody(userSchemas.loginWithPhone),
  userAuthController.loginWithPhone
);

/**
 * @route POST /api/app/auth/check-phone
 * @description Check if phone number exists
 * @body {string} phone - User phone number
 * @returns {Object} Phone existence status
 */
router.post('/check-phone',
  validateBody(userSchemas.checkPhone),
  userAuthController.checkPhoneExists
);

/**
 * @route POST /api/app/auth/refresh-token
 * @description Refresh access token
 * @body {string} refreshToken - Refresh token
 * @returns {Object} New access token
 */
router.post('/refresh-token',
  validateBody(userSchemas.refreshToken),
  userAuthController.refreshToken
);

/**
 * Protected routes (user authentication required)
 */

/**
 * @route POST /api/app/auth/logout
 * @description User logout
 * @header {string} Authorization - Bearer token
 * @returns {Object} Success message
 */
router.post('/logout',
  authenticate,
  userAuthController.logout
);

/**
 * @route GET /api/app/auth/profile
 * @description Get user profile
 * @header {string} Authorization - Bearer token
 * @returns {Object} User profile
 */
router.get('/profile',
  authenticate,
  userAuthController.getProfile
);

/**
 * @route PUT /api/app/auth/profile
 * @description Update user profile
 * @header {string} Authorization - Bearer token
 * @body {string} [name] - User name
 * @body {string} [email] - User email
 * @body {string} [phone] - User phone
 * @returns {Object} Updated user profile
 */
router.put('/profile',
  authenticate,
  validateBody(userSchemas.update),
  userAuthController.updateProfile
);

/**
 * @route PUT /api/app/auth/change-password
 * @description Change user password
 * @header {string} Authorization - Bearer token
 * @body {string} currentPassword - Current password
 * @body {string} newPassword - New password
 * @returns {Object} Success message
 */
router.put('/change-password',
  authenticate,
  validateBody(userSchemas.changePassword),
  userAuthController.changePassword
);

/**
 * @route DELETE /api/app/auth/account
 * @description Delete user account (soft delete)
 * @header {string} Authorization - Bearer token
 * @returns {Object} Success message
 */
router.delete('/account',
  authenticate,
  userAuthController.deleteAccount
);

/**
 * Admin-only routes for user management
 */

/**
 * @route GET /api/app/auth/users
 * @description Get all users (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 * @query {boolean} [includeDeleted=false] - Include soft deleted users
 * @query {string} [search] - Search term
 * @returns {Object} List of users with pagination
 */
router.get('/users',
  authenticate,
  isAdmin,
  userAuthController.getAllUsers
);

/**
 * @route GET /api/app/auth/users/:id
 * @description Get user by ID (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @param {string} id - User ID
 * @returns {Object} User data
 */
router.get('/users/:id',
  authenticate,
  isAdmin,
  validateParams({ id: schemas.mongoId.required() }),
  userAuthController.getUserById
);

/**
 * @route PUT /api/app/auth/users/:id
 * @description Update user by ID (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @param {string} id - User ID
 * @body {string} [name] - User name
 * @body {string} [email] - User email
 * @body {string} [phone] - User phone
 * @returns {Object} Updated user data
 */
router.put('/users/:id',
  authenticate,
  isAdmin,
  validateParams({ id: schemas.mongoId.required() }),
  validateBody(userSchemas.update),
  userAuthController.updateUserById
);

/**
 * @route DELETE /api/app/auth/users/:id
 * @description Soft delete user by ID (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @param {string} id - User ID
 * @returns {Object} Success message
 */
router.delete('/users/:id',
  authenticate,
  isAdmin,
  validateParams({ id: schemas.mongoId.required() }),
  userAuthController.deleteUserById
);

/**
 * @route POST /api/app/auth/users/:id/restore
 * @description Restore soft deleted user (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @param {string} id - User ID
 * @returns {Object} Restored user data
 */
router.post('/users/:id/restore',
  authenticate,
  isAdmin,
  validateParams({ id: schemas.mongoId.required() }),
  userAuthController.restoreUser
);

/**
 * @route DELETE /api/app/auth/users/:id/permanent
 * @description Permanently delete user (Admin only)
 * @header {string} Authorization - Bearer token (Admin)
 * @param {string} id - User ID
 * @returns {Object} Success message
 */
router.delete('/users/:id/permanent',
  authenticate,
  isAdmin,
  validateParams({ id: schemas.mongoId.required() }),
  userAuthController.permanentDeleteUser
);

export default router;