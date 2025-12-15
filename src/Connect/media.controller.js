/**
 * @fileoverview Media controller for Connect feature (user-facing uploads)
 * @module controllers/connect/media
 */

import cloudinary from "../../config/cloudinary.config.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Determine media type from mimetype
 * @param {string} mimetype - File mimetype
 * @returns {string} - "IMAGE" or "VIDEO"
 */
const getMediaType = (mimetype) => {
  if (mimetype.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimetype.startsWith("video/")) {
    return "VIDEO";
  }
  return null;
};

/**
 * Upload media (image or video) for Connect posts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const uploadConnectMedia = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return responseUtil.badRequest(res, "No file provided");
    }

    // Determine media type
    const mediaType = getMediaType(file.mimetype);
    if (!mediaType) {
      return responseUtil.badRequest(
        res,
        "Invalid file type. Only images and videos are allowed."
      );
    }

    // Convert buffer to base64 data URI
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString(
      "base64"
    )}`;

    // Generate unique public_id
    const timestamp = Date.now();
    const sanitizedName = file.originalname
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 30);
    const publicId = `${sanitizedName}-${userId.slice(-6)}-${timestamp}`;

    // Configure upload options based on media type
    const uploadOptions = {
      folder: "connect/posts",
      public_id: publicId,
      resource_type: mediaType === "VIDEO" ? "video" : "image",
      overwrite: false,
    };

    // Add video-specific options
    if (mediaType === "VIDEO") {
      uploadOptions.eager = [
        // Generate thumbnail
        { format: "jpg", transformation: [{ width: 480, crop: "scale" }] },
      ];
      uploadOptions.eager_async = false;
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

    // Prepare response
    const response = {
      originalName: file.originalname,
      publicId: result.public_id,
      mediaType: mediaType,
      mediaUrl: result.secure_url,
      format: result.format,
      size: result.bytes,
    };

    // Add dimensions for images
    if (mediaType === "IMAGE") {
      response.width = result.width;
      response.height = result.height;
    }

    // Add video-specific data
    if (mediaType === "VIDEO") {
      response.duration = result.duration;
      response.width = result.width;
      response.height = result.height;

      // Get thumbnail URL from eager transformation
      if (result.eager && result.eager.length > 0) {
        response.thumbnailUrl = result.eager[0].secure_url;
      } else {
        // Fallback: generate thumbnail URL manually
        response.thumbnailUrl = cloudinary.url(result.public_id, {
          resource_type: "video",
          format: "jpg",
          transformation: [{ width: 480, crop: "scale" }],
        });
      }
    }

    return responseUtil.success(res, "Media uploaded successfully", response);
  } catch (error) {
    console.error("[CONNECT MEDIA] Upload error:", error);

    // Handle specific Cloudinary errors
    if (error.message?.includes("File size too large")) {
      return responseUtil.badRequest(
        res,
        "File size too large. Maximum size is 50MB."
      );
    }

    if (error.message?.includes("Invalid image")) {
      return responseUtil.badRequest(res, "Invalid or corrupted file");
    }

    return responseUtil.internalError(
      res,
      "Failed to upload media",
      error.message
    );
  }
};

/**
 * Delete media from Cloudinary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteConnectMedia = async (req, res) => {
  try {
    const { publicId, mediaType } = req.body;

    if (!publicId) {
      return responseUtil.badRequest(res, "publicId is required");
    }

    const resourceType = mediaType === "VIDEO" ? "video" : "image";

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result === "ok") {
      return responseUtil.success(res, "Media deleted successfully", {
        publicId,
      });
    } else if (result.result === "not found") {
      return responseUtil.notFound(res, "Media not found");
    } else {
      return responseUtil.badRequest(res, "Failed to delete media", result);
    }
  } catch (error) {
    console.error("[CONNECT MEDIA] Delete error:", error);
    return responseUtil.internalError(
      res,
      "Failed to delete media",
      error.message
    );
  }
};

export default {
  uploadConnectMedia,
  deleteConnectMedia,
};
