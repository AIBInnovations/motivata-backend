/**
 * @fileoverview Route handler for show-delete endpoint.
 * @module Other/app/showDelete
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateTicketImage } from "../../../utils/ticketImage.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, "../../../settings.json");
// Note: fs is still used for reading settings.json in show-delete endpoint

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

/**
 * GET /api/app/service/test-ticket
 * @description Test endpoint to generate ticket image with embedded QR code
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Buffer} PNG image of the ticket
 */
router.get("/test-ticket", async (req, res) => {
  try {
    // Hardcoded test data
    const testData = {
      qrData: "https://motivata.synquic.com/api/app/tickets/cash/qr-scan?enrollmentId=692d2a005c88ba59811d5c98&userId=692d2a005c88ba59811d5c95&eventId=69292ed8d2442cf27713bda5&phone=9406667051",
      eventName: "UTSAV EVENT 2025",
      eventMode: "OFFLINE",
      eventLocation: "INDORE",
      eventStartDate: new Date("2025-12-21T14:00:00"),
      eventEndDate: new Date("2025-12-21T22:00:00"),
      ticketCount: 1,
      ticketPrice: "499",
      venueName: "ESSENTIA HOTEL, INDORE",
      bookingId: "692d2a005c88ba59811d5c98"
    };

    console.log("[TEST-TICKET] Starting ticket generation with test data");

    // Generate ticket image using the utility
    const imageBuffer = await generateTicketImage(testData);

    console.log(`[TEST-TICKET] Image generated: ${imageBuffer.length} bytes`);

    // Return image directly
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", imageBuffer.length);
    return res.send(imageBuffer);
  } catch (error) {
    console.error("Test ticket generation error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate ticket", details: error.message });
  }
});

export default router;
