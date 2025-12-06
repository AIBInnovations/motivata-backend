/**
 * @fileoverview Asset controller for global file upload management
 * @module controllers/asset
 */

import cloudinary from "../../config/cloudinary.config.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Upload single or multiple images to Cloudinary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const uploadAssets = async (req, res) => {
  try {
    const files = req.files;
    const { folder = "assets" } = req.body;

    if (!files || files.length === 0) {
      return responseUtil.badRequest(res, "No files provided");
    }

    const uploadResults = [];
    const errors = [];

    for (const file of files) {
      try {
        // Convert buffer to base64 data URI
        const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

        // Generate unique public_id
        const timestamp = Date.now();
        const sanitizedName = file.originalname
          .replace(/\.[^/.]+$/, "") // Remove extension
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .replace(/-+/g, "-")
          .substring(0, 50);
        const publicId = `${sanitizedName}-${timestamp}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(base64Image, {
          folder: folder,
          public_id: publicId,
          resource_type: "auto",
          overwrite: false,
        });

        // Generate download URL with attachment flag
        const downloadUrl = cloudinary.url(result.public_id, {
          flags: "attachment",
          secure: true,
          format: result.format,
        });

        uploadResults.push({
          originalName: file.originalname,
          publicId: result.public_id,
          publicUrl: result.secure_url,
          downloadUrl: downloadUrl,
          format: result.format,
          size: result.bytes,
          width: result.width,
          height: result.height,
        });
      } catch (uploadError) {
        console.error(`[ASSET] Failed to upload ${file.originalname}:`, uploadError.message);
        errors.push({
          originalName: file.originalname,
          error: uploadError.message,
        });
      }
    }

    if (uploadResults.length === 0) {
      return responseUtil.badRequest(res, "All uploads failed", { errors });
    }

    return responseUtil.success(res, "Assets uploaded successfully", {
      uploaded: uploadResults,
      failed: errors.length > 0 ? errors : null,
      totalUploaded: uploadResults.length,
      totalFailed: errors.length,
    });
  } catch (error) {
    console.error("[ASSET] Upload error:", error);
    return responseUtil.internalError(res, "Failed to upload assets", error.message);
  }
};

/**
 * Get download URL for a given public URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDownloadUrl = async (req, res) => {
  try {
    const { publicUrl } = req.body;

    if (!publicUrl) {
      return responseUtil.badRequest(res, "publicUrl is required");
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const urlPattern = /\/upload\/(?:v\d+\/)?(.+)$/;
    const match = publicUrl.match(urlPattern);

    if (!match) {
      return responseUtil.badRequest(res, "Invalid Cloudinary URL format");
    }

    // Remove file extension from public_id
    const publicIdWithFormat = match[1];
    const lastDotIndex = publicIdWithFormat.lastIndexOf(".");
    const publicId = lastDotIndex !== -1 ? publicIdWithFormat.substring(0, lastDotIndex) : publicIdWithFormat;
    const format = lastDotIndex !== -1 ? publicIdWithFormat.substring(lastDotIndex + 1) : null;

    // Generate download URL with attachment flag
    const downloadUrl = cloudinary.url(publicId, {
      flags: "attachment",
      secure: true,
      format: format,
    });

    return responseUtil.success(res, "Download URL generated", {
      publicUrl,
      downloadUrl,
      publicId,
    });
  } catch (error) {
    console.error("[ASSET] Get download URL error:", error);
    return responseUtil.internalError(res, "Failed to generate download URL", error.message);
  }
};

/**
 * Delete an asset from Cloudinary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteAsset = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return responseUtil.badRequest(res, "publicId is required");
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      return responseUtil.success(res, "Asset deleted successfully", { publicId });
    } else if (result.result === "not found") {
      return responseUtil.notFound(res, "Asset not found");
    } else {
      return responseUtil.badRequest(res, "Failed to delete asset", result);
    }
  } catch (error) {
    console.error("[ASSET] Delete error:", error);
    return responseUtil.internalError(res, "Failed to delete asset", error.message);
  }
};

export default {
  uploadAssets,
  getDownloadUrl,
  deleteAsset,
};
