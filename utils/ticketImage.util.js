/**
 * @fileoverview Ticket image generation utility
 * Generates ticket images with embedded QR codes using HTML template
 * @module utils/ticketImage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import nodeHtmlToImage from 'node-html-to-image';
import cloudinary from '../config/cloudinary.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template and asset paths
const TICKET_TEMPLATE_PATH = path.join(__dirname, '../templates/ticket.template.html');
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
    console.log(`[TICKET-IMAGE] ========== GENERATING TICKET IMAGE ==========`);
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

    // Read HTML template
    let templateHtml = fs.readFileSync(TICKET_TEMPLATE_PATH, 'utf-8');

    // Format event date and time
    const eventDateTime = eventStartDate
      ? `${formatTicketDate(eventStartDate)} &nbsp;&nbsp;|&nbsp;&nbsp; ${formatTimeRange(eventStartDate, eventEndDate)}`
      : '';

    // Format ticket price
    const formattedPrice = ticketPrice ? `${ticketPrice} Rs` : 'FREE';

    // Get event initial for thumbnail
    const eventInitial = eventName.charAt(0).toUpperCase();

    // Short booking ID (last 7 characters)
    const shortBookingId = bookingId.slice(-7).toUpperCase();

    // Replace all placeholders
    const finalHtml = templateHtml
      .replace(/\{\{logoDataUrl\}\}/g, logoDataUrl)
      .replace(/\{\{qrCodeDataUrl\}\}/g, qrCodeDataUrl)
      .replace(/\{\{eventName\}\}/g, eventName)
      .replace(/\{\{eventInitial\}\}/g, eventInitial)
      .replace(/\{\{eventMode\}\}/g, eventMode.toUpperCase())
      .replace(/\{\{eventLocation\}\}/g, eventLocation.toUpperCase())
      .replace(/\{\{eventDateTime\}\}/g, eventDateTime)
      .replace(/\{\{ticketCount\}\}/g, String(ticketCount))
      .replace(/\{\{ticketPrice\}\}/g, formattedPrice)
      .replace(/\{\{venueName\}\}/g, venueName.toUpperCase())
      .replace(/\{\{bookingId\}\}/g, shortBookingId);

    console.log(`[TICKET-IMAGE] HTML template populated`);
    console.log(`[TICKET-IMAGE] Converting HTML to image...`);

    // Convert HTML to PNG image with timeout
    const TIMEOUT_MS = 30000; // 30 seconds timeout

    const imagePromise = nodeHtmlToImage({
      html: finalHtml,
      type: 'png',
      quality: 100,
      encoding: 'buffer',
      puppeteerArgs: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--disable-software-rasterizer'
        ],
      },
      selector: '.ticket-container',
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Ticket image generation timed out after 30 seconds')), TIMEOUT_MS);
    });

    const imageBuffer = await Promise.race([imagePromise, timeoutPromise]);

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Generated image buffer is empty');
    }

    console.log(`[TICKET-IMAGE] Image generated: ${imageBuffer.length} bytes`);
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
