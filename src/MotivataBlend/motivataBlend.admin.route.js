/**
 * @fileoverview Motivata Blend admin routes
 * Handles admin operations for Motivata Blend registration requests
 * @module routes/motivataBlend/admin
 */

import express from 'express';
import multer from 'multer';
import { authenticate, isAdmin } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  motivataBlendSchemas
} from '../../middleware/validation.middleware.js';
import {
  getAllMotivataBlendRequests,
  getMotivataBlendRequestById,
  approveMotivataBlendRequest,
  rejectMotivataBlendRequest,
  getMotivataBlendStats,
  getPendingCount
} from './motivataBlend.admin.controller.js';
import { upsertBanner, deleteBanner } from './motivataBlendBanner.admin.controller.js';
import { getActiveBanner } from './motivataBlendBanner.controller.js';

// Multer config for banner image upload
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF, and WebP are allowed.`), false);
    }
  },
});

const router = express.Router();

/**
 * PUBLIC ROUTES (no auth required)
 */

/**
 * @route   GET /api/web/motivata-blend/admin/banner
 * @desc    Get the current Motivata Blend banner
 * @access  Public
 */
router.get('/banner', getActiveBanner);

/**
 * All routes below require authentication + admin role
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/motivata-blend/admin/stats
 * @desc    Get Motivata Blend statistics
 * @access  Admin
 */
router.get('/stats', getMotivataBlendStats);

/**
 * @route   GET /api/web/motivata-blend/admin/pending-count
 * @desc    Get pending requests count
 * @access  Admin
 */
router.get('/pending-count', getPendingCount);

/**
 * @route   GET /api/web/motivata-blend/admin/requests
 * @desc    Get all Motivata Blend requests with filters
 * @access  Admin
 */
router.get(
  '/requests',
  validateQuery(motivataBlendSchemas.list),
  getAllMotivataBlendRequests
);

/**
 * @route   GET /api/web/motivata-blend/admin/requests/:id
 * @desc    Get single Motivata Blend request by ID
 * @access  Admin
 */
router.get(
  '/requests/:id',
  validateParams(motivataBlendSchemas.requestId),
  getMotivataBlendRequestById
);

/**
 * @route   POST /api/web/motivata-blend/admin/requests/:id/approve
 * @desc    Approve a Motivata Blend request
 * @access  Admin
 */
router.post(
  '/requests/:id/approve',
  validateParams(motivataBlendSchemas.requestId),
  validateBody(motivataBlendSchemas.approve),
  approveMotivataBlendRequest
);

/**
 * @route   POST /api/web/motivata-blend/admin/requests/:id/reject
 * @desc    Reject a Motivata Blend request
 * @access  Admin
 */
router.post(
  '/requests/:id/reject',
  validateParams(motivataBlendSchemas.requestId),
  validateBody(motivataBlendSchemas.reject),
  rejectMotivataBlendRequest
);

/**
 * @route   POST /api/web/motivata-blend/admin/banner
 * @desc    Upload or update the Motivata Blend banner image
 * @access  Admin
 */
router.post('/banner', bannerUpload.single('image'), upsertBanner);

/**
 * @route   DELETE /api/web/motivata-blend/admin/banner
 * @desc    Delete the Motivata Blend banner
 * @access  Admin
 */
router.delete('/banner', deleteBanner);

export default router;
