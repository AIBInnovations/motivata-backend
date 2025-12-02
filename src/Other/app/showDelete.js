/**
 * @fileoverview Route handler for show-delete endpoint.
 * @module Other/app/showDelete
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, "../../../settings.json");

/** @type {express.Router} */
const router = express.Router();

/**
 * GET /api/app/service/show-delete
 * @description Returns a status flag indicating delete functionality is available.
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Object} JSON response with status boolean
 */
router.get("/show-delete", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    return res.status(200).json({ status: settings.showDelete });
  } catch (error) {
    return res.status(200).json({ status: true });
  }
});

export default router;
