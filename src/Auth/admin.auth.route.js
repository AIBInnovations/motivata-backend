/**
 * @fileoverview Admin authentication routes
 * @module routes/admin-auth
 */

import express from 'express';
import Joi from 'joi';
import * as adminAuthController from './admin.auth.controller.js';
import { authenticate, isAdmin, isSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, adminSchemas, schemas } from '../../middleware/validation.middleware.js';

const router = express.Router();

/**
 * Public routes (no authentication required)
 */

/**
 * @route POST /api/web/auth/register
 * @description Register first super admin (only works when no admins exist)
 * @body {string} name - Admin name
 * @body {string} username - Admin username
 * @body {string} [email] - Admin email (optional)
 * @body {string} [phone] - Admin phone (optional)
 * @body {string} password - Admin password
 * @returns {Object} Admin data and tokens
 */
router.post('/register',
  validateBody(adminSchemas.register),
  adminAuthController.register
);

/**
 * @route POST /api/web/auth/login
 * @description Admin login
 * @body {string} username - Admin username
 * @body {string} password - Admin password
 * @returns {Object} Admin data and tokens
 */
router.post('/login',
  validateBody(adminSchemas.login),
  adminAuthController.login
);

/**
 * @route POST /api/web/auth/refresh-token
 * @description Refresh access token
 * @body {string} refreshToken - Refresh token
 * @returns {Object} New access token
 */
router.post('/refresh-token',
  validateBody(adminSchemas.refreshToken),
  adminAuthController.refreshToken
);

/**
 * Protected routes (authentication required)
 */

/**
 * @route POST /api/web/auth/logout
 * @description Admin logout
 * @header {string} Authorization - Bearer token
 * @returns {Object} Success message
 */
router.post('/logout',
  authenticate,
  isAdmin,
  adminAuthController.logout
);

/**
 * @route GET /api/web/auth/profile
 * @description Get admin profile
 * @header {string} Authorization - Bearer token
 * @returns {Object} Admin profile
 */
router.get('/profile',
  authenticate,
  isAdmin,
  adminAuthController.getProfile
);

/**
 * @route PUT /api/web/auth/profile
 * @description Update admin profile
 * @header {string} Authorization - Bearer token
 * @body {string} [name] - Admin name
 * @body {string} [username] - Admin username
 * @body {string} [email] - Admin email
 * @body {string} [phone] - Admin phone
 * @returns {Object} Updated admin profile
 */
router.put('/profile',
  authenticate,
  isAdmin,
  validateBody(adminSchemas.update),
  adminAuthController.updateProfile
);

/**
 * @route PUT /api/web/auth/change-password
 * @description Change admin password
 * @header {string} Authorization - Bearer token
 * @body {string} currentPassword - Current password
 * @body {string} newPassword - New password
 * @returns {Object} Success message
 */
router.put('/change-password',
  authenticate,
  isAdmin,
  validateBody(adminSchemas.changePassword),
  adminAuthController.changePassword
);

/**
 * Super Admin only routes
 */

/**
 * @route POST /api/web/auth/create
 * @description Create new admin (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @body {string} name - Admin name
 * @body {string} username - Admin username
 * @body {string} [email] - Admin email (optional)
 * @body {string} [phone] - Admin phone (optional)
 * @body {string} password - Admin password
 * @body {string} [role] - Admin role
 * @body {string[]} [access] - Admin access permissions
 * @returns {Object} Created admin data
 */
router.post('/create',
  authenticate,
  isSuperAdmin,
  validateBody(adminSchemas.register),
  adminAuthController.register
);

/**
 * @route GET /api/web/auth/admins
 * @description Get all admins (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 * @query {string} [status] - Filter by status
 * @query {string} [role] - Filter by role
 * @query {string} [search] - Search term
 * @returns {Object} List of admins with pagination
 */
router.get('/admins',
  authenticate,
  isSuperAdmin,
  adminAuthController.getAllAdmins
);

/**
 * @route GET /api/web/auth/admins/:id
 * @description Get admin by ID (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @returns {Object} Admin data
 */
router.get('/admins/:id',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required() })),
  adminAuthController.getAdminById
);

/**
 * @route PUT /api/web/auth/admins/:id
 * @description Update admin by ID (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @body {string} [name] - Admin name
 * @body {string} [username] - Admin username
 * @body {string} [email] - Admin email
 * @body {string} [phone] - Admin phone
 * @body {string} [role] - Admin role
 * @body {string[]} [access] - Admin access permissions
 * @body {string} [status] - Admin status
 * @returns {Object} Updated admin data
 */
router.put('/admins/:id',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required() })),
  validateBody(adminSchemas.update),
  adminAuthController.updateAdminById
);

/**
 * @route DELETE /api/web/auth/admins/:id
 * @description Delete admin by ID (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @returns {Object} Success message
 */
router.delete('/admins/:id',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required() })),
  adminAuthController.deleteAdminById
);

/**
 * Allowed Events Management Routes (Super Admin only)
 */

/**
 * @route GET /api/web/auth/admins/:id/allowed-events
 * @description Get allowed events for an admin (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @returns {Object} List of allowed events
 */
router.get('/admins/:id/allowed-events',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required() })),
  adminAuthController.getAllowedEvents
);

/**
 * @route PUT /api/web/auth/admins/:id/allowed-events
 * @description Update allowed events for an admin (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @body {string[]} allowedEvents - Array of event IDs
 * @returns {Object} Updated admin data
 */
router.put('/admins/:id/allowed-events',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required() })),
  validateBody(adminSchemas.updateAllowedEvents),
  adminAuthController.updateAllowedEvents
);

/**
 * @route POST /api/web/auth/admins/:id/allowed-events/:eventId
 * @description Add event to admin's allowed events (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @param {string} eventId - Event ID to add
 * @returns {Object} Updated admin data
 */
router.post('/admins/:id/allowed-events/:eventId',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required(), eventId: schemas.mongoId.required() })),
  adminAuthController.addAllowedEvent
);

/**
 * @route DELETE /api/web/auth/admins/:id/allowed-events/:eventId
 * @description Remove event from admin's allowed events (Super Admin only)
 * @header {string} Authorization - Bearer token
 * @param {string} id - Admin ID
 * @param {string} eventId - Event ID to remove
 * @returns {Object} Updated admin data
 */
router.delete('/admins/:id/allowed-events/:eventId',
  authenticate,
  isSuperAdmin,
  validateParams(Joi.object({ id: schemas.mongoId.required(), eventId: schemas.mongoId.required() })),
  adminAuthController.removeAllowedEvent
);

export default router;