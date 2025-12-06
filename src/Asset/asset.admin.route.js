/**
 * @fileoverview Admin asset routes for file upload management
 * @module routes/asset/admin
 */

import express from "express";
import multer from "multer";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import { uploadAssets, deleteAsset } from "./asset.controller.js";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
    }
  },
});

/**
 * @route POST /api/web/assets/upload
 * @description Upload single or multiple images
 * @access Admin only
 * @body {files[]} files - Image files to upload (multipart/form-data)
 * @body {string} [folder] - Optional folder name in Cloudinary (default: "assets")
 */
router.post(
  "/upload",
  authenticate,
  isAdmin,
  upload.array("files", 10),
  uploadAssets
);

/**
 * @route DELETE /api/web/assets
 * @description Delete an asset from Cloudinary
 * @access Admin only
 * @body {string} publicId - Cloudinary public ID of the asset to delete
 */
router.delete("/", authenticate, isAdmin, deleteAsset);

export default router;
