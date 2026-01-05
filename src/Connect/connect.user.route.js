/**
 * @fileoverview User routes for Connect social feature (follow, posts, likes)
 * @module routes/connect/user
 */

import express from "express";
import multer from "multer";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  getUserProfile,
  checkFollowStatus,
} from "./connect.controller.js";
import {
  createPost,
  getFeed,
  getExploreFeed,
  getMyPosts,
  getUserPosts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  sharePost,
  getPostLikers,
  openPostDeepLink,
} from "./post.controller.js";
import { uploadConnectMedia } from "./media.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  connectSchemas,
} from "../../middleware/validation.middleware.js";
import clubUserRoutes from "../Club/club.user.route.js";

const router = express.Router();

// ============================================
// MEDIA UPLOAD ROUTES
// ============================================

// Configure multer for memory storage (images + videos)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimeTypes = [
      // Images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      // Videos
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
      "video/3gpp",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only images and videos are allowed.`
        ),
        false
      );
    }
  },
});

/**
 * @route POST /api/app/connect/media/upload
 * @description Upload media (image or video) for Connect posts
 * @access Private (authenticated users)
 * @body {file} file - Image or video file (multipart/form-data)
 */
router.post(
  "/media/upload",
  authenticate,
  upload.single("file"),
  uploadConnectMedia
);

// ============================================
// POST ROUTES
// ============================================

/**
 * @route POST /api/app/connect/posts
 * @description Create a new post
 * @access Private (authenticated users)
 * @body {string} [content] - Post text content
 * @body {string} [mediaType] - IMAGE or VIDEO
 * @body {string} [mediaUrl] - Media URL from upload
 * @body {string} [mediaThumbnail] - Thumbnail URL for videos
 */
router.post(
  "/posts",
  authenticate,
  validateBody(connectSchemas.createPost),
  createPost
);

/**
 * @route GET /api/app/connect/posts/feed
 * @description Get personalized feed (posts from followed users + own)
 * @access Private (authenticated users)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 */
router.get(
  "/posts/feed",
  authenticate,
  validateQuery(connectSchemas.feedQuery),
  getFeed
);

/**
 * @route GET /api/app/connect/posts/explore
 * @description Get explore feed (all posts, latest first)
 * @access Public (optional auth for like status)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 */
router.get(
  "/posts/explore",
  optionalAuth,
  validateQuery(connectSchemas.feedQuery),
  getExploreFeed
);

/**
 * @route GET /api/app/connect/posts/me
 * @description Get current user's own posts
 * @access Private (authenticated users)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 */
router.get(
  "/posts/me",
  authenticate,
  validateQuery(connectSchemas.feedQuery),
  getMyPosts
);

/**
 * @route GET /api/app/connect/posts/:postId
 * @description Get single post by ID
 * @access Public (optional auth for like status)
 */
router.get(
  "/posts/:postId",
  optionalAuth,
  validateParams(connectSchemas.postId),
  getPostById
);

/**
 * @route DELETE /api/app/connect/posts/:postId
 * @description Delete own post
 * @access Private (authenticated users)
 */
router.delete(
  "/posts/:postId",
  authenticate,
  validateParams(connectSchemas.postId),
  deletePost
);

/**
 * @route POST /api/app/connect/posts/:postId/like
 * @description Like a post
 * @access Private (authenticated users)
 */
router.post(
  "/posts/:postId/like",
  authenticate,
  validateParams(connectSchemas.postId),
  likePost
);

/**
 * @route DELETE /api/app/connect/posts/:postId/like
 * @description Unlike a post
 * @access Private (authenticated users)
 */
router.delete(
  "/posts/:postId/like",
  authenticate,
  validateParams(connectSchemas.postId),
  unlikePost
);

/**
 * @route POST /api/app/connect/posts/:postId/share
 * @description Increment share count and get deep link
 * @access Private (authenticated users)
 */
router.post(
  "/posts/:postId/share",
  authenticate,
  validateParams(connectSchemas.postId),
  sharePost
);

/**
 * @route GET /api/app/connect/posts/:postId/open
 * @description Redirect to post deep link (for shared links)
 * @access Public
 */
router.get(
  "/posts/:postId/open",
  validateParams(connectSchemas.postId),
  openPostDeepLink
);

/**
 * @route GET /api/app/connect/posts/:postId/likers
 * @description Get users who liked a post
 * @access Public (optional auth for follow status)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 */
router.get(
  "/posts/:postId/likers",
  optionalAuth,
  validateParams(connectSchemas.postId),
  validateQuery(connectSchemas.paginationQuery),
  getPostLikers
);

// ============================================
// USER SEARCH ROUTES
// ============================================

/**
 * @route GET /api/app/connect/users/search
 * @description Search users by name, email, or phone
 * @access Public (optional auth for follow status)
 * @query {string} search - Search term (min 2 characters)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 */
router.get(
  "/users/search",
  optionalAuth,
  validateQuery(connectSchemas.searchQuery),
  searchUsers
);

/**
 * @route GET /api/app/connect/users/:userId
 * @description Get user profile
 * @access Public (optional auth for follow status)
 */
router.get(
  "/users/:userId",
  optionalAuth,
  validateParams(connectSchemas.userId),
  getUserProfile
);

/**
 * @route GET /api/app/connect/users/:userId/posts
 * @description Get posts by a specific user
 * @access Public (optional auth for like status)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page
 */
router.get(
  "/users/:userId/posts",
  optionalAuth,
  validateParams(connectSchemas.userId),
  validateQuery(connectSchemas.feedQuery),
  getUserPosts
);

/**
 * @route GET /api/app/connect/users/:userId/followers
 * @description Get followers of a user
 * @access Public (optional auth for follow status)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 */
router.get(
  "/users/:userId/followers",
  optionalAuth,
  validateParams(connectSchemas.userId),
  validateQuery(connectSchemas.paginationQuery),
  getFollowers
);

/**
 * @route GET /api/app/connect/users/:userId/following
 * @description Get users that a user is following
 * @access Public (optional auth for follow status)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 */
router.get(
  "/users/:userId/following",
  optionalAuth,
  validateParams(connectSchemas.userId),
  validateQuery(connectSchemas.paginationQuery),
  getFollowing
);

// ============================================
// FOLLOW ROUTES
// ============================================

/**
 * @route POST /api/app/connect/follow/:userId
 * @description Follow a user
 * @access Private (authenticated users)
 */
router.post(
  "/follow/:userId",
  authenticate,
  validateParams(connectSchemas.userId),
  followUser
);

/**
 * @route DELETE /api/app/connect/follow/:userId
 * @description Unfollow a user
 * @access Private (authenticated users)
 */
router.delete(
  "/follow/:userId",
  authenticate,
  validateParams(connectSchemas.userId),
  unfollowUser
);

/**
 * @route GET /api/app/connect/follow/:userId/status
 * @description Check if following a user
 * @access Private (authenticated users)
 */
router.get(
  "/follow/:userId/status",
  authenticate,
  validateParams(connectSchemas.userId),
  checkFollowStatus
);

// ============================================
// CLUB ROUTES
// ============================================

/**
 * Club routes - /api/app/connect/clubs
 * Includes: list clubs, join/leave, club feed, club members
 */
router.use("/clubs", clubUserRoutes);

export default router;
