/**
 * @fileoverview Admin settings routes
 * @module routes/admin/settings
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import responseUtil from "../../../utils/response.util.js";
import {
  authenticate,
  isAdmin,
} from "../../../middleware/auth.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, "../../../settings.json");

/** @type {express.Router} */
const router = express.Router();

/**
 * All routes require authentication and admin access
 */
router.use(authenticate);
router.use(isAdmin);

/**
 * @route   GET /api/web/settings/show-delete
 * @desc    Get current show-delete setting
 * @access  Admin
 * @returns {Object} Current show-delete status
 */
router.get("/show-delete", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    return responseUtil.success(res, "Settings fetched", {
      showDelete: settings.showDelete,
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to read settings", error.message);
  }
});

/**
 * @route   PUT /api/web/settings/show-delete
 * @desc    Update show-delete setting
 * @access  Admin
 * @body    {boolean} showDelete - New show-delete status
 * @returns {Object} Updated settings
 */
router.put("/show-delete", (req, res) => {
  try {
    const { showDelete } = req.body;

    if (typeof showDelete !== "boolean") {
      return responseUtil.badRequest(res, "showDelete must be a boolean");
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    settings.showDelete = showDelete;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    return responseUtil.success(res, "Settings updated", {
      showDelete: settings.showDelete,
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to update settings", error.message);
  }
});

export default router;
