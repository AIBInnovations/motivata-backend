/**
 * @fileoverview Public asset routes for download URL generation
 * @module routes/asset/public
 */

import express from "express";
import { getDownloadUrl } from "./asset.controller.js";

const router = express.Router();

/**
 * @route POST /api/app/assets/download-url
 * @description Get download URL for a given public Cloudinary URL
 * @access Public (no auth required)
 * @body {string} publicUrl - The public Cloudinary URL
 */
router.post("/download-url", getDownloadUrl);

export default router;
