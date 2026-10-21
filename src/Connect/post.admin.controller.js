/**
 * @fileoverview Admin post controller - create and manage posts for the Explore tab
 * @module controllers/connect/postAdmin
 */

import Post from "../../schema/Post.schema.js";
import Like from "../../schema/Like.schema.js";
import cloudinary from "../../config/cloudinary.config.js";
import responseUtil from "../../utils/response.util.js";
import multer from "multer";
import { CONTENT_CATEGORIES, CONTENT_MAX_WORDS, countContentWords } from "./content.constants.js";
import { FULL_POST_ACCESS_ROLES } from "../Auth/adminPages.constants.js";

const LINK_PATTERN = /^https?:\/\/\S+$/i;

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
    }
  },
});

// ============================================
// HELPERS
// ============================================

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const canManageAnyPost = (reqUser) => FULL_POST_ACCESS_ROLES.includes(reqUser?.role);

const formatAdminPost = (post, currentAdminId = null) => ({
  id: post._id,
  title: post.title || "",
  subHeading: post.subHeading || "",
  category: post.category || "",
  videoUrl: post.videoUrl || "",
  linkUrl: post.linkUrl || "",
  content: post.content || "",
  caption: post.caption || "",
  mediaType: post.mediaType,
  mediaUrls: post.mediaUrls,
  mediaThumbnail: post.mediaThumbnail,
  likeCount: post.likeCount,
  shareCount: post.shareCount,
  author: {
    id: post.author?._id || null,
    name: post.author?.name || "",
  },
  isAdminPost: true,
  isOwnPost: currentAdminId && post.author?._id ? post.author._id.toString() === currentAdminId : false,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

// ============================================
// CONTROLLERS
// ============================================

/**
 * Upload a photo to Cloudinary (admin)
 * POST /api/web/connect/media/upload
 */
export const uploadAdminMedia = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return responseUtil.badRequest(res, "No file provided");
    }

    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const timestamp = Date.now();
    const sanitizedName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 30);
    const publicId = `admin-${sanitizedName}-${timestamp}`;

    const result = await cloudinary.uploader.upload(base64Data, {
      folder: "connect/admin-posts",
      public_id: publicId,
      resource_type: "image",
      overwrite: false,
    });

    return responseUtil.success(res, "Media uploaded successfully", {
      originalName: file.originalname,
      publicId: result.public_id,
      mediaType: "IMAGE",
      mediaUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    });
  } catch (error) {
    console.error("[ADMIN POST] Upload media error:", error);
    return responseUtil.internalError(res, "Failed to upload media", error.message);
  }
};

/**
 * Create an admin post (shown in Explore tab)
 * POST /api/web/connect/posts
 */
export const createAdminPost = async (req, res) => {
  try {
    const { title, subHeading, category, videoUrl, linkUrl, content, caption, mediaUrls, mediaThumbnail } = req.body;
    const adminId = req.user.id;

    if (!title || !title.trim()) {
      return responseUtil.badRequest(res, "Title is required");
    }

    if (category && !CONTENT_CATEGORIES.includes(category)) {
      return responseUtil.badRequest(res, "Choose a valid category");
    }

    if (content && countContentWords(content) > CONTENT_MAX_WORDS) {
      return responseUtil.badRequest(res, `Text cannot exceed ${CONTENT_MAX_WORDS} words`);
    }

    if (videoUrl && !LINK_PATTERN.test(videoUrl.trim())) {
      return responseUtil.badRequest(res, "Video link must start with http:// or https://");
    }

    if (linkUrl && !LINK_PATTERN.test(linkUrl.trim())) {
      return responseUtil.badRequest(res, "Link must start with http:// or https://");
    }

    if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      return responseUtil.badRequest(res, "At least one photo URL is required");
    }

    if (mediaUrls.length > 10) {
      return responseUtil.badRequest(res, "Cannot have more than 10 photos");
    }

    const post = new Post({
      authorType: "Admin",
      author: adminId,
      title: title.trim(),
      subHeading: subHeading?.trim() || "",
      category: category || "",
      videoUrl: videoUrl?.trim() || "",
      linkUrl: linkUrl?.trim() || "",
      content: content?.trim() || "",
      caption: caption?.trim() || "",
      mediaType: "IMAGE",
      mediaUrls,
      mediaThumbnail: mediaThumbnail || null,
      club: null,
      isExplorePost: true,
    });

    await post.save();
    await post.populate({ path: "author", select: "name email" });

    return responseUtil.created(res, "Post created successfully", {
      post: formatAdminPost(post),
    });
  } catch (error) {
    console.error("[ADMIN POST] Create post error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }
    return responseUtil.internalError(res, "Failed to create post", error.message);
  }
};

/**
 * Get all admin posts (paginated)
 * GET /api/web/connect/posts
 */
export const getAdminPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const adminId = req.user.id;
    const skip = (Number(page) - 1) * Number(limit);

    const query = { isExplorePost: true, club: null };

    if (search && String(search).trim()) {
      const pattern = new RegExp(escapeRegex(String(search).trim().slice(0, 100)), "i");
      query.$or = [{ title: pattern }, { subHeading: pattern }, { caption: pattern }, { content: pattern }];
    }

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .populate({ path: "author", select: "name email" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return responseUtil.success(res, "Posts fetched successfully", {
      posts: posts.map((post) => formatAdminPost(post, adminId)),
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("[ADMIN POST] Get posts error:", error);
    return responseUtil.internalError(res, "Failed to fetch posts", error.message);
  }
};

/**
 * Delete an admin post
 * DELETE /api/web/connect/posts/:postId
 */
export const deleteAdminPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    const isOwnPost = post.author.toString() === adminId;
    const canDeleteAny = canManageAnyPost(req.user) && post.isExplorePost;

    if (!isOwnPost && !canDeleteAny) {
      return responseUtil.forbidden(res, "You can only delete your own posts");
    }

    await post.softDelete();
    await Like.softDeleteByPost(postId);

    return responseUtil.success(res, "Post deleted successfully");
  } catch (error) {
    console.error("[ADMIN POST] Delete post error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }
    return responseUtil.internalError(res, "Failed to delete post", error.message);
  }
};

export const updateAdminPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user.id;

    const post = await Post.findById(postId);
    if (!post || !post.isExplorePost) {
      return responseUtil.notFound(res, "Post not found");
    }

    const isOwnPost = post.author.toString() === adminId;
    if (!isOwnPost && !canManageAnyPost(req.user)) {
      return responseUtil.forbidden(res, "You can only edit your own posts");
    }

    const updates = {};
    for (const field of ["title", "subHeading", "category", "videoUrl", "linkUrl", "content", "caption", "mediaUrls"]) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (req.body.mediaThumbnail !== undefined) {
      updates.mediaThumbnail = req.body.mediaThumbnail || null;
    }

    post.set(updates);
    await post.save();
    await post.populate({ path: "author", select: "name email" });

    return responseUtil.success(res, "Post updated successfully", {
      post: formatAdminPost(post, adminId),
    });
  } catch (error) {
    console.error("[ADMIN POST] Update post error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }
    return responseUtil.internalError(res, "Failed to update post", error.message);
  }
};

export const getContentCategories = (_req, res) =>
  responseUtil.success(res, "Content categories fetched", {
    categories: CONTENT_CATEGORIES,
    maxWords: CONTENT_MAX_WORDS,
  });

export default {
  getContentCategories,
  uploadAdminMedia,
  createAdminPost,
  updateAdminPost,
  getAdminPosts,
  deleteAdminPost,
};
