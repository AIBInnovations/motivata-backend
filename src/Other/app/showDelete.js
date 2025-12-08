/**
 * @fileoverview Route handler for show-delete endpoint.
 * @module Other/app/showDelete
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import nodeHtmlToImage from "node-html-to-image";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, "../../../settings.json");
const ticketTemplatePath = path.join(
  __dirname,
  "../../../templates/ticket.template.html"
);
const logoPath = path.join(__dirname, "../../../assets/w-font-logo-1024x512.png");

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
 * POST /api/app/service/test-ticket
 * @description Test endpoint to generate ticket image with QR code and send via email
 * @param {express.Request} req - Express request object
 * @param {string} req.body.link - The link to encode in the QR code
 * @param {express.Response} res - Express response object
 * @returns {Object} JSON response with email send status
 */
router.get("/test-ticket", async (req, res) => {
  try {
    // Hardcoded link for testing
    const link = "https://motivata.synquic.com/api/app/tickets/cash/qr-scan?enrollmentId=692d2a005c88ba59811d5c98&userId=692d2a005c88ba59811d5c95&eventId=69292ed8d2442cf27713bda5&phone=9406667051";

    console.log("[TEST-TICKET] Starting ticket generation for link:", link);

    // Generate QR code as data URL (base64)
    const qrCodeDataUrl = await QRCode.toDataURL(link, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    console.log("[TEST-TICKET] QR code generated successfully");

    // Read logo and convert to base64
    const logoBuffer = fs.readFileSync(logoPath);
    const logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;

    console.log("[TEST-TICKET] Logo loaded successfully");

    // Read HTML template
    const templateHtml = fs.readFileSync(ticketTemplatePath, "utf-8");

    // Replace placeholders with actual data URLs
    const finalHtml = templateHtml
      .replace("{{qrCodeDataUrl}}", qrCodeDataUrl)
      .replace("{{logoDataUrl}}", logoDataUrl);

    console.log("[TEST-TICKET] Converting HTML to image...");

    // Convert HTML to image (PNG)
    const imageBuffer = await nodeHtmlToImage({
      html: finalHtml,
      type: "png",
      quality: 100,
      encoding: "buffer",
      puppeteerArgs: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      selector: ".ticket-container",
    });

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
