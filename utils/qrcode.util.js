/**
 * @fileoverview QR Code generation utility
 * @module utils/qrcode
 */

import QRCode from 'qrcode';
import cloudinary from '../config/cloudinary.config.js';

/**
 * Generate QR code as PNG buffer
 * Optimized for email attachments and AWS EC2 memory efficiency
 *
 * @param {Object} params - QR code generation parameters
 * @param {string} params.enrollmentId - Enrollment ID
 * @param {string} params.userId - User ID
 * @param {string} params.eventId - Event ID
 * @param {string} params.phone - Phone number for the ticket
 * @param {string} [params.baseUrl='https://motivata.synquic.com'] - Base URL for the verification endpoint
 *
 * @returns {Promise<Buffer>} QR code as PNG buffer
 * @throws {Error} If QR code generation fails
 */
export const generateTicketQRCode = async ({
  enrollmentId,
  userId,
  eventId,
  phone,
  baseUrl = 'https://motivata.synquic.com'
}) => {
  try {
    console.log(`[QR-UTIL] Generating QR code for ticket: ${phone}`);

    if (!enrollmentId || !userId || !eventId || !phone) {
      throw new Error('Missing required parameters for QR code generation');
    }

    // Create QR scan URL (reusing the existing mock QR link format)
    const qrScanUrl = `${baseUrl}/api/app/tickets/qr-scan?enrollmentId=${enrollmentId}&userId=${userId}&eventId=${eventId}&phone=${phone}`;

    console.log(`[QR-UTIL] QR URL: ${qrScanUrl}`);

    // Generate QR code as buffer with optimized settings for email
    const qrBuffer = await QRCode.toBuffer(qrScanUrl, {
      errorCorrectionLevel: 'H', // High error correction for damaged/dirty prints
      type: 'png',
      width: 400, // Reduced from 500 to save memory/bandwidth
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log(`[QR-UTIL] QR code generated successfully (${qrBuffer.length} bytes)`);

    return qrBuffer;
  } catch (error) {
    console.error(`[QR-UTIL] Failed to generate QR code:`, error);
    throw new Error(`QR code generation failed: ${error.message}`);
  }
};

/**
 * Generate filename for QR code attachment
 *
 * @param {Object} params - Filename generation parameters
 * @param {string} params.eventName - Event name
 * @param {string} params.phone - Phone number
 *
 * @returns {string} Sanitized filename
 */
export const generateQRFilename = ({ eventName, phone }) => {
  // Sanitize event name for filename
  const sanitizedEventName = eventName
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Sanitize phone for filename
  const sanitizedPhone = phone.replace(/[^0-9]/g, '');

  return `ticket-${sanitizedEventName}-${sanitizedPhone}.png`;
};

/**
 * Upload QR code buffer to Cloudinary and get public URL
 *
 * @param {Object} params - Upload parameters
 * @param {Buffer} params.qrBuffer - QR code as PNG buffer
 * @param {string} params.enrollmentId - Enrollment ID for folder organization
 * @param {string} params.phone - Phone number for filename
 * @param {string} [params.eventName] - Event name for folder organization
 *
 * @returns {Promise<string>} Public URL of uploaded QR code
 * @throws {Error} If upload fails
 */
export const uploadQRCodeToCloudinary = async ({
  qrBuffer,
  enrollmentId,
  phone,
  eventName = 'event'
}) => {
  try {
    console.log(`[QR-UPLOAD] ========== STARTING CLOUDINARY UPLOAD ==========`);
    console.log(`[QR-UPLOAD] Input parameters:`);
    console.log(`[QR-UPLOAD]   - Phone: ${phone}`);
    console.log(`[QR-UPLOAD]   - Enrollment ID: ${enrollmentId}`);
    console.log(`[QR-UPLOAD]   - Event Name: ${eventName}`);
    console.log(`[QR-UPLOAD]   - Buffer size: ${qrBuffer?.length || 0} bytes`);

    if (!qrBuffer || qrBuffer.length === 0) {
      throw new Error('QR buffer is empty or undefined');
    }

    // Sanitize event name for folder path
    const sanitizedEventName = eventName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // Sanitize phone for public_id
    const sanitizedPhone = phone.replace(/[^0-9]/g, '');

    const folderPath = `tickets/${sanitizedEventName}/${enrollmentId}`;
    const publicId = `qr-${sanitizedPhone}`;

    console.log(`[QR-UPLOAD] Upload config:`);
    console.log(`[QR-UPLOAD]   - Folder: ${folderPath}`);
    console.log(`[QR-UPLOAD]   - Public ID: ${publicId}`);
    console.log(`[QR-UPLOAD]   - Full path: ${folderPath}/${publicId}`);

    // Convert buffer to base64 data URI
    const base64Image = `data:image/png;base64,${qrBuffer.toString('base64')}`;
    console.log(`[QR-UPLOAD]   - Base64 length: ${base64Image.length} characters`);

    console.log(`[QR-UPLOAD] Calling Cloudinary uploader...`);

    // Upload to Cloudinary with folder structure: tickets/{eventName}/{enrollmentId}/
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: folderPath,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      format: 'png'
    });

    console.log(`[QR-UPLOAD] ✓ Cloudinary upload successful!`);
    console.log(`[QR-UPLOAD] Response details:`);
    console.log(`[QR-UPLOAD]   - Public ID: ${result.public_id}`);
    console.log(`[QR-UPLOAD]   - Secure URL: ${result.secure_url}`);
    console.log(`[QR-UPLOAD]   - Format: ${result.format}`);
    console.log(`[QR-UPLOAD]   - Size: ${result.bytes} bytes`);
    console.log(`[QR-UPLOAD]   - Dimensions: ${result.width}x${result.height}`);
    console.log(`[QR-UPLOAD] ========== CLOUDINARY UPLOAD COMPLETE ==========`);

    return result.secure_url;
  } catch (error) {
    console.error(`[QR-UPLOAD] ✗ FAILED to upload QR code to Cloudinary`);
    console.error(`[QR-UPLOAD] Error type: ${error.name}`);
    console.error(`[QR-UPLOAD] Error message: ${error.message}`);
    console.error(`[QR-UPLOAD] Error details:`, error);
    console.error(`[QR-UPLOAD] ========== CLOUDINARY UPLOAD FAILED ==========`);
    throw new Error(`QR code upload failed: ${error.message}`);
  }
};

export default {
  generateTicketQRCode,
  generateQRFilename,
  uploadQRCodeToCloudinary
};
