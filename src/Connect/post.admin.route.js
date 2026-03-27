/**
 * @fileoverview Admin routes for managing Explore tab posts
 * @module routes/connect/postAdmin
 *
 * Base path: /api/web/connect
 */

import express from "express";
import {
  upload,
  uploadAdminMedia,
  createAdminPost,
  getAdminPosts,
  deleteAdminPost,
} from "./post.admin.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticate, isAdmin);

/**
 * @route POST /api/web/connect/media/upload
 * @description Upload a photo for an admin post
 * @access Admin
 * @body {file} file - Image file (multipart/form-data)
 */
router.post("/media/upload", upload.single("file"), uploadAdminMedia);

/**
 * @route POST /api/web/connect/posts
 * @description Create a new admin post (appears in Explore tab)
 * @access Admin
 * @body {string} title - Post title (required)
 * @body {string[]} mediaUrls - Array of photo URLs from upload endpoint (required)
 * @body {string} [content] - Post content/context
 * @body {string} [caption] - Short caption
 * @body {string} [mediaThumbnail] - Thumbnail URL
 */
router.post("/posts", createAdminPost);

/**
 * @route GET /api/web/connect/posts
 * @description Get all posts created by this admin
 * @access Admin
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 */
router.get("/posts", getAdminPosts);

/**
 * @route DELETE /api/web/connect/posts/:postId
 * @description Delete an admin post
 * @access Admin
 */
router.delete("/posts/:postId", deleteAdminPost);

export default router;
