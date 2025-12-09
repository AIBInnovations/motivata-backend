/**
 * @fileoverview Ticket image generation utility
 * Generates ticket images with embedded QR codes using SVG + Sharp
 * NO PUPPETEER - uses native image processing
 * @module utils/ticketImage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import sharp from 'sharp';
import cloudinary from '../config/cloudinary.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logo path
const LOGO_PATH = path.join(__dirname, '../assets/w-font-logo-1024x512.png');

// Cache logo as base64 to avoid repeated file reads
let cachedLogoDataUrl = null;

/**
 * Get logo as base64 data URL (cached)
 * @returns {string} Logo as base64 data URL
 */
const getLogoDataUrl = () => {
  if (!cachedLogoDataUrl) {
    const logoBuffer = fs.readFileSync(LOGO_PATH);
    cachedLogoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    console.log('[TICKET-IMAGE] Logo loaded and cached');
  }
  return cachedLogoDataUrl;
};

/**
 * Format date for ticket display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string like "Sunday, 21st Dec"
 */
const formatTicketDate = (date) => {
  if (!date) return '';

  const d = new Date(date);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[d.getDay()];
  const day = d.getDate();
  const month = months[d.getMonth()];

  // Add ordinal suffix
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${dayName}, ${ordinal(day)} ${month}`;
};

/**
 * Format time range for ticket display
 * @param {Date|string} startDate - Start date/time
 * @param {Date|string} endDate - End date/time
 * @returns {string} Formatted time range like "2 PM - 10 PM"
 */
const formatTimeRange = (startDate, endDate) => {
  if (!startDate) return '';

  const formatTime = (date) => {
    const d = new Date(date);
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours} ${ampm}`;
  };

  const startTime = formatTime(startDate);

  if (endDate) {
    const endTime = formatTime(endDate);
    return `${startTime} - ${endTime}`;
  }

  return startTime;
};

/**
 * Generate QR code as base64 data URL
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<string>} QR code as base64 data URL
 */
const generateQRCodeDataUrl = async (data) => {
  return await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 200,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
};

/**
 * Escape XML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeXml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generate SVG ticket template
 * @param {Object} params - Template parameters
 * @returns {string} SVG string
 */
const generateTicketSVG = ({
  logoDataUrl,
  qrCodeDataUrl,
  eventName,
  eventInitial,
  eventMode,
  eventLocation,
  eventDateTime,
  ticketCount,
  ticketPrice,
  venueName,
  bookingId
}) => {
  // Escape all text content for XML
  const safeEventName = escapeXml(eventName);
  const safeEventInitial = escapeXml(eventInitial);
  const safeEventMode = escapeXml(eventMode);
  const safeEventLocation = escapeXml(eventLocation);
  const safeEventDateTime = escapeXml(eventDateTime);
  const safeTicketCount = escapeXml(ticketCount);
  const safeTicketPrice = escapeXml(ticketPrice);
  const safeVenueName = escapeXml(venueName);
  const safeBookingId = escapeXml(bookingId);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="380" height="520" viewBox="0 0 380 520" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="thumbnailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff6b6b"/>
      <stop offset="100%" style="stop-color:#ffa500"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="380" height="520" fill="#0d0d0d"/>

  <!-- Logo -->
  <image x="90" y="24" width="200" height="40" href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>

  <!-- Event Thumbnail (gradient circle with initial) -->
  <rect x="28" y="84" width="50" height="50" rx="10" fill="url(#thumbnailGradient)"/>
  <text x="53" y="117" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle">${safeEventInitial}</text>

  <!-- Event Details -->
  <text x="92" y="100" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#ffffff">${safeEventName}</text>
  <text x="92" y="116" font-family="Arial, sans-serif" font-size="10" fill="#888888" letter-spacing="1">${safeEventMode} | ${safeEventLocation}</text>
  <text x="92" y="132" font-family="Arial, sans-serif" font-size="12" fill="#cccccc">${safeEventDateTime}</text>

  <!-- QR Code Section -->
  <!-- White background for QR -->
  <rect x="106" y="160" width="168" height="168" rx="12" fill="#ffffff"/>
  <!-- QR Code Image -->
  <image x="118" y="172" width="144" height="144" href="${qrCodeDataUrl}"/>

  <!-- Ticket Count -->
  <text x="190" y="355" font-family="Arial, sans-serif" font-size="13" font-weight="500" fill="#ffffff" text-anchor="middle" letter-spacing="2">TICKET FOR ${safeTicketCount}</text>

  <!-- Ticket Price -->
  <text x="190" y="378" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#ffffff" text-anchor="middle">${safeTicketPrice}</text>

  <!-- Dashed Divider -->
  <line x1="28" y1="410" x2="352" y2="410" stroke="#333333" stroke-width="2" stroke-dasharray="8,6"/>

  <!-- Venue Name -->
  <text x="190" y="448" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="1">${safeVenueName}</text>

  <!-- Booking ID -->
  <text x="190" y="475" font-family="Arial, sans-serif" font-size="12" fill="#666666" text-anchor="middle">Booking ID: <tspan fill="#888888">${safeBookingId}</tspan></text>
</svg>`;
};

/**
 * Generate ticket image with embedded QR code
 *
 * @param {Object} params - Ticket generation parameters
 * @param {string} params.qrData - Data to encode in QR code (scan URL)
 * @param {string} params.eventName - Event name
 * @param {string} [params.eventMode='OFFLINE'] - Event mode (OFFLINE/ONLINE)
 * @param {string} [params.eventLocation=''] - Event location/city
 * @param {Date|string} [params.eventStartDate] - Event start date/time
 * @param {Date|string} [params.eventEndDate] - Event end date/time
 * @param {number} [params.ticketCount=1] - Number of tickets
 * @param {string|number} [params.ticketPrice=''] - Ticket price
 * @param {string} [params.venueName=''] - Venue name
 * @param {string} params.bookingId - Booking/Enrollment ID
 *
 * @returns {Promise<Buffer>} Ticket image as PNG buffer
 * @throws {Error} If ticket generation fails
 */
export const generateTicketImage = async ({
  qrData,
  eventName,
  eventMode = 'OFFLINE',
  eventLocation = '',
  eventStartDate,
  eventEndDate,
  ticketCount = 1,
  ticketPrice = '',
  venueName = '',
  bookingId
}) => {
  try {
    console.log(`[TICKET-IMAGE] ========== GENERATING TICKET IMAGE (SVG+Sharp) ==========`);
    console.log(`[TICKET-IMAGE] Event: ${eventName}`);
    console.log(`[TICKET-IMAGE] Booking ID: ${bookingId}`);
    console.log(`[TICKET-IMAGE] QR Data length: ${qrData?.length || 0}`);

    if (!qrData || !eventName || !bookingId) {
      throw new Error('Missing required parameters: qrData, eventName, bookingId');
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await generateQRCodeDataUrl(qrData);
    console.log(`[TICKET-IMAGE] QR code generated`);

    // Get logo data URL (cached)
    const logoDataUrl = getLogoDataUrl();

    // Format event date and time
    const eventDateTime = eventStartDate
      ? `${formatTicketDate(eventStartDate)}  |  ${formatTimeRange(eventStartDate, eventEndDate)}`
      : '';

    // Format ticket price
    const formattedPrice = ticketPrice ? `${ticketPrice} Rs` : 'FREE';

    // Get event initial for thumbnail
    const eventInitial = eventName.charAt(0).toUpperCase();

    // Short booking ID (last 7 characters)
    const shortBookingId = bookingId.slice(-7).toUpperCase();

    // Generate SVG
    const svgString = generateTicketSVG({
      logoDataUrl,
      qrCodeDataUrl,
      eventName,
      eventInitial,
      eventMode: eventMode.toUpperCase(),
      eventLocation: eventLocation.toUpperCase(),
      eventDateTime,
      ticketCount: String(ticketCount),
      ticketPrice: formattedPrice,
      venueName: venueName.toUpperCase(),
      bookingId: shortBookingId
    });

    console.log(`[TICKET-IMAGE] SVG generated (${svgString.length} chars)`);

    // Convert SVG to PNG using Sharp
    const imageBuffer = await sharp(Buffer.from(svgString))
      .png()
      .toBuffer();

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Generated image buffer is empty');
    }

    console.log(`[TICKET-IMAGE] PNG generated: ${imageBuffer.length} bytes`);
    console.log(`[TICKET-IMAGE] ========== TICKET IMAGE COMPLETE ==========`);

    return imageBuffer;
  } catch (error) {
    console.error(`[TICKET-IMAGE] Failed to generate ticket image:`, error.message);
    throw new Error(`Ticket image generation failed: ${error.message}`);
  }
};

/**
 * Generate ticket image filename
 *
 * @param {Object} params - Filename parameters
 * @param {string} params.eventName - Event name
 * @param {string} params.phone - Phone number
 *
 * @returns {string} Sanitized filename
 */
export const generateTicketFilename = ({ eventName, phone }) => {
  const sanitizedEventName = eventName
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const sanitizedPhone = phone.replace(/[^0-9]/g, '').slice(-10);

  return `ticket-${sanitizedEventName}-${sanitizedPhone}.png`;
};

/**
 * Upload ticket image to Cloudinary
 *
 * @param {Object} params - Upload parameters
 * @param {Buffer} params.imageBuffer - Ticket image as PNG buffer
 * @param {string} params.enrollmentId - Enrollment ID for folder organization
 * @param {string} params.phone - Phone number for filename
 * @param {string} [params.eventName='event'] - Event name for folder
 *
 * @returns {Promise<string>} Public URL of uploaded ticket image
 * @throws {Error} If upload fails
 */
export const uploadTicketImageToCloudinary = async ({
  imageBuffer,
  enrollmentId,
  phone,
  eventName = 'event'
}) => {
  try {
    console.log(`[TICKET-UPLOAD] ========== UPLOADING TICKET IMAGE ==========`);
    console.log(`[TICKET-UPLOAD] Enrollment ID: ${enrollmentId}`);
    console.log(`[TICKET-UPLOAD] Phone: ${phone}`);
    console.log(`[TICKET-UPLOAD] Buffer size: ${imageBuffer?.length || 0} bytes`);

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer is empty or undefined');
    }

    // Sanitize event name for folder path
    const sanitizedEventName = eventName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // Sanitize phone for public_id
    const sanitizedPhone = phone.replace(/[^0-9]/g, '').slice(-10);

    const folderPath = `tickets/${sanitizedEventName}/${enrollmentId}`;
    const publicId = `ticket-${sanitizedPhone}`;

    console.log(`[TICKET-UPLOAD] Folder: ${folderPath}`);
    console.log(`[TICKET-UPLOAD] Public ID: ${publicId}`);

    // Convert buffer to base64 data URI
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: folderPath,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      format: 'png'
    });

    console.log(`[TICKET-UPLOAD] Upload successful!`);
    console.log(`[TICKET-UPLOAD] URL: ${result.secure_url}`);
    console.log(`[TICKET-UPLOAD] Size: ${result.bytes} bytes`);
    console.log(`[TICKET-UPLOAD] ========== TICKET UPLOAD COMPLETE ==========`);

    return result.secure_url;
  } catch (error) {
    console.error(`[TICKET-UPLOAD] Failed to upload ticket image:`, error);
    throw new Error(`Ticket image upload failed: ${error.message}`);
  }
};

/**
 * Generate and upload ticket image in one call
 * Convenience function that combines generation and upload
 *
 * @param {Object} params - Combined parameters
 * @param {string} params.qrData - Data to encode in QR code
 * @param {string} params.eventName - Event name
 * @param {string} [params.eventMode='OFFLINE'] - Event mode
 * @param {string} [params.eventLocation=''] - Event location
 * @param {Date|string} [params.eventStartDate] - Event start date
 * @param {Date|string} [params.eventEndDate] - Event end date
 * @param {number} [params.ticketCount=1] - Number of tickets
 * @param {string|number} [params.ticketPrice=''] - Ticket price
 * @param {string} [params.venueName=''] - Venue name
 * @param {string} params.bookingId - Booking/Enrollment ID
 * @param {string} params.enrollmentId - Enrollment ID for upload
 * @param {string} params.phone - Phone number
 *
 * @returns {Promise<{imageBuffer: Buffer, imageUrl: string}>} Image buffer and Cloudinary URL
 */
export const generateAndUploadTicketImage = async (params) => {
  const imageBuffer = await generateTicketImage(params);

  const imageUrl = await uploadTicketImageToCloudinary({
    imageBuffer,
    enrollmentId: params.enrollmentId,
    phone: params.phone,
    eventName: params.eventName
  });

  return { imageBuffer, imageUrl };
};

export default {
  generateTicketImage,
  generateTicketFilename,
  uploadTicketImageToCloudinary,
  generateAndUploadTicketImage
};
