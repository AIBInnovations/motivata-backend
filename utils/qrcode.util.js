/**
 * @fileoverview QR Code generation utility
 * @module utils/qrcode
 */

import QRCode from 'qrcode';

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

export default {
  generateTicketQRCode,
  generateQRFilename
};
