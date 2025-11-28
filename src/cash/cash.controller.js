/**
 * @fileoverview Cash payment controller for direct cash payments
 * Handles cash payment orders and ticket generation without payment gateway
 * @module cash/controller
 */

import Event from '../../schema/Event.schema.js';
import User from '../../schema/User.schema.js';
import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import CashPartner from '../../schema/CashPartner.schema.js';
import Payment from '../../schema/Payment.schema.js';
import bcrypt from 'bcryptjs';
import responseUtil from '../../utils/response.util.js';
import { sendBulkEmails } from '../../utils/email.util.js';
import {
  generateTicketEmail,
  generateTicketEmailText
} from '../../utils/emailTemplate.util.js';
import { generateTicketQRCode, generateQRFilename, uploadQRCodeToCloudinary } from '../../utils/qrcode.util.js';
import { sendBulkTicketWhatsApp } from '../../utils/whatsapp.util.js';

/**
 * @typedef {Object} CashOrderRequest
 * @property {string} partnerCode - 6-digit cash partner code
 * @property {string} type - Payment type (e.g., 'EVENT')
 * @property {string} eventId - Event ID
 * @property {string} [priceTierId] - Pricing tier ID (optional for multi-tier events)
 * @property {Object} metadata - Additional metadata
 * @property {Object} metadata.buyer - Buyer information
 * @property {string} metadata.buyer.name - Buyer's name
 * @property {string} metadata.buyer.email - Buyer's email
 * @property {string} metadata.buyer.phone - Buyer's phone number
 * @property {Array<Object>} [metadata.others] - Other ticket holders (optional)
 */

/**
 * @typedef {Object} CashOrderResponse
 * @property {number} status - HTTP status code (201)
 * @property {string} message - Success message
 * @property {Object} data - Response data
 * @property {string} data.orderId - Generated order ID
 * @property {string} data.paymentId - Generated payment ID
 * @property {number} data.totalAmount - Total payment amount
 * @property {number} data.ticketCount - Number of tickets
 * @property {string} data.eventName - Event name
 * @property {Array<string>} data.ticketHolders - List of ticket holder emails
 */

/**
 * Create a cash payment order and generate tickets
 * Validates event, creates users, generates enrollment, and sends ticket emails
 *
 * @route POST /api/web/cash/order
 * @access Public (authenticated cash partners)
 *
 * @param {import('express').Request} req - Express request object
 * @param {CashOrderRequest} req.body - Cash order request data
 *
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<CashOrderResponse>} JSON response with order details
 *
 * @throws {400} Bad Request - If validation fails
 * @throws {404} Not Found - If event or pricing tier not found
 * @throws {500} Internal Server Error - If order processing fails
 *
 * @description
 * This endpoint handles cash payment orders from verified cash partners.
 * It creates users, enrollments, generates QR codes, and sends ticket emails.
 * Unlike Razorpay payments, this doesn't create Payment records.
 *
 * Generated IDs format:
 * - orderId: `{partnerCode}_{timestamp}`
 * - paymentId: `CASH_{partnerCode}_{timestamp}`
 *
 * @example
 * // Single Ticket Purchase
 * POST /api/web/cash/order
 * {
 *   "partnerCode": "123456",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "priceTierId": "507f1f77bcf86cd799439099",
 *   "metadata": {
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     }
 *   }
 * }
 *
 * @example
 * // Multi-Ticket Purchase
 * POST /api/web/cash/order
 * {
 *   "partnerCode": "123456",
 *   "type": "EVENT",
 *   "eventId": "507f1f77bcf86cd799439011",
 *   "priceTierId": "507f1f77bcf86cd799439099",
 *   "metadata": {
 *     "buyer": {
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "phone": "+919876543210"
 *     },
 *     "others": [
 *       {
 *         "name": "Jane Smith",
 *         "email": "jane@example.com",
 *         "phone": "+919876543211"
 *       }
 *     ]
 *   }
 * }
 */
export const createCashOrder = async (req, res) => {
  try {
    console.log('=== Cash Order Request Received ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { partnerCode, type, eventId, priceTierId, metadata } = req.body;

    // Validate required fields
    if (!partnerCode) {
      return responseUtil.badRequest(res, 'Partner code is required');
    }

    if (!type || type !== 'EVENT') {
      return responseUtil.badRequest(res, 'Invalid or missing payment type');
    }

    if (!eventId) {
      return responseUtil.badRequest(res, 'Event ID is required');
    }

    if (!metadata || !metadata.buyer) {
      return responseUtil.badRequest(res, 'Buyer information is required');
    }

    const { buyer, others = [] } = metadata;

    // Validate buyer information - email is optional, phone is required
    if (!buyer.name || !buyer.phone) {
      return responseUtil.badRequest(res, 'Buyer name and phone are required');
    }

    // Validate others array if present - email is optional, phone is required
    if (others.length > 0) {
      for (const other of others) {
        if (!other.name || !other.phone) {
          return responseUtil.badRequest(res, 'All ticket holders must have name and phone');
        }
      }
    }

    // Verify cash partner exists
    const cashPartner = await CashPartner.findOne({ partnerCode });
    if (!cashPartner) {
      return responseUtil.notFound(res, 'Invalid partner code');
    }

    console.log('[CASH-ORDER] Cash partner verified:', cashPartner.name);

    // Fetch event
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    if (!event.isLive) {
      return responseUtil.badRequest(res, 'Event is not available for booking');
    }

    console.log('[CASH-ORDER] Event found:', event.name);

    // Calculate ticket count
    const totalTickets = 1 + others.length;

    // Check available seats
    if (event.availableSeats != null && event.availableSeats < totalTickets) {
      return responseUtil.badRequest(res, `Only ${event.availableSeats} seats available`);
    }

    // Determine pricing
    let ticketPrice = 0;
    let tierName = null;

    if (event.pricingTiers && event.pricingTiers.length > 0) {
      // Multi-tier pricing
      if (!priceTierId) {
        return responseUtil.badRequest(res, 'Pricing tier ID is required for this event');
      }

      const tier = event.pricingTiers.id(priceTierId);
      if (!tier) {
        return responseUtil.notFound(res, 'Pricing tier not found');
      }

      ticketPrice = tier.price;
      tierName = tier.name;
      console.log(`[CASH-ORDER] Using pricing tier: ${tierName} (₹${ticketPrice})`);
    } else {
      // Simple pricing
      ticketPrice = event.price;
      console.log(`[CASH-ORDER] Using simple pricing: ₹${ticketPrice}`);
    }

    // Calculate total amount
    const totalAmount = ticketPrice * totalTickets;

    // Generate order ID and payment ID
    const timestamp = Date.now();
    const orderId = `${partnerCode}_${timestamp}`;
    const paymentId = `CASH_${partnerCode}_${timestamp}`;

    console.log('[CASH-ORDER] Generated IDs:', { orderId, paymentId });
    console.log('[CASH-ORDER] Order details:', {
      totalTickets,
      ticketPrice,
      totalAmount,
      tierName
    });

    // Create/get buyer user
    const buyerUser = await findOrCreateUser(buyer);

    // Create/get users for all other ticket holders
    const otherUsers = [];
    for (const other of others) {
      console.log('[CASH-ORDER] Processing additional ticket holder:', {
        name: other.name,
        email: other.email,
        phone: other.phone
      });
      const otherUser = await findOrCreateUser(other);
      otherUsers.push({ user: otherUser, details: other });
    }

    // Check if enrollment already exists for this user and event
    const existingEnrollment = await EventEnrollment.findOne({
      userId: buyerUser._id,
      eventId: event._id
    });

    if (existingEnrollment) {
      console.log('[CASH-ORDER] Enrollment already exists for this user and event');
      return responseUtil.conflict(res, 'User is already enrolled in this event');
    }

    // Create tickets Map with phone numbers as keys
    const ticketsMap = new Map();

    // Add buyer's ticket
    ticketsMap.set(buyer.phone, {
      status: 'ACTIVE',
      cancelledAt: null,
      cancellationReason: null,
      isTicketScanned: false,
      ticketScannedAt: null,
      ticketScannedBy: null
    });

    // Add other tickets
    for (const other of others) {
      ticketsMap.set(other.phone, {
        status: 'ACTIVE',
        cancelledAt: null,
        cancellationReason: null,
        isTicketScanned: false,
        ticketScannedAt: null,
        ticketScannedBy: null
      });
    }

    // Create enrollment
    const enrollment = new EventEnrollment({
      paymentId: paymentId,
      orderId: orderId,
      userId: buyerUser._id,
      eventId: event._id,
      ticketCount: totalTickets,
      tierName: tierName,
      ticketPrice: ticketPrice,
      tickets: ticketsMap
    });

    await enrollment.save();

    console.log('[CASH-ORDER] Enrollment created successfully:', {
      enrollmentId: enrollment._id,
      buyerId: buyerUser._id,
      eventId: event._id,
      ticketCount: totalTickets,
      tickets: Array.from(ticketsMap.keys())
    });

    // Create Payment record for cash transaction
    const payment = new Payment({
      orderId: orderId,
      paymentId: paymentId,
      userId: buyerUser._id,
      type: 'EVENT',
      eventId: event._id,
      amount: totalAmount,
      finalAmount: totalAmount,
      discountAmount: 0,
      status: 'SUCCESS',
      purchaseDateTime: new Date(),
      metadata: {
        paymentMethod: 'CASH',
        partnerCode: cashPartner.partnerCode,
        partnerName: cashPartner.name,
        buyer: buyer,
        others: others,
        totalTickets: totalTickets
      }
    });
    await payment.save();

    console.log('[CASH-ORDER] Payment record created:', {
      paymentId: payment._id,
      orderId: payment.orderId,
      method: 'CASH'
    });

    // Update event ticket counts
    event.ticketsSold = (event.ticketsSold || 0) + totalTickets;

    // Decrement availableSeats if it exists
    if (event.availableSeats != null && event.availableSeats > 0) {
      event.availableSeats = Math.max(0, event.availableSeats - totalTickets);
    }

    await event.save();

    console.log('[CASH-ORDER] Event ticket counts updated:', {
      eventId: event._id,
      ticketsSold: event.ticketsSold,
      availableSeats: event.availableSeats
    });

    // Add enrollment to cash partner's records
    cashPartner.eventEnrollments.push(enrollment._id);
    await cashPartner.save();

    console.log('[CASH-ORDER] Enrollment added to cash partner record');

    // Send ticket emails with QR codes
    await sendTicketEmails(enrollment, buyerUser, buyer, otherUsers, event);

    console.log('=== Cash Order Processing Complete ===\n');

    // Return success response
    const ticketHolders = [buyer.phone, ...others.map(o => o.phone)];

    return responseUtil.created(res, 'Cash order processed successfully', {
      orderId,
      paymentId,
      totalAmount,
      ticketCount: totalTickets,
      eventName: event.name,
      eventId: event._id,
      enrollmentId: enrollment._id,
      tierName,
      ticketHolders
    });

  } catch (error) {
    console.error('[CASH-ORDER] Error processing cash order:', error);
    return responseUtil.internalError(res, 'Failed to process cash order', error.message);
  }
};

/**
 * Find or create user by phone number
 * If user doesn't exist, creates a new user with phone as password
 * Email is optional - users can be created with just phone number
 *
 * @param {Object} userData - User data
 * @param {string} userData.name - User's name
 * @param {string} [userData.email] - User's email (optional)
 * @param {string} userData.phone - User's phone number
 *
 * @returns {Promise<Object>} User document
 * @private
 */
const findOrCreateUser = async (userData) => {
  const { name, email } = userData;

  // Normalize phone number - extract last 10 digits if country code is present
  let phone = userData.phone;
  if (phone && phone.length > 10) {
    phone = phone.slice(-10);
    console.log(`[CASH-USER] Phone normalized from ${userData.phone} to ${phone}`);
  }

  console.log(`[CASH-USER] Checking if user exists with phone: ${phone}`);

  // Try to find user by phone number
  let user = await User.findOne({ phone, isDeleted: false });

  if (user) {
    console.log(`[CASH-USER] User found with phone ${phone}:`, {
      userId: user._id,
      name: user.name,
      email: user.email || '(no email)'
    });
    return user;
  }

  // User doesn't exist, create new user
  console.log(`[CASH-USER] User not found with phone ${phone}, creating new user`);

  try {
    // Use phone number as password for cash payment users
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(phone, salt);

    // Create user data - email is optional
    const newUserData = {
      name,
      phone,
      password: hashedPassword
    };

    // Only add email if provided and not empty
    if (email && email.trim()) {
      newUserData.email = email.trim().toLowerCase();
    }

    user = new User(newUserData);

    await user.save();

    console.log(`[CASH-USER] New user created successfully:`, {
      userId: user._id,
      name: user.name,
      email: user.email || '(no email)',
      phone: user.phone
    });

    return user;
  } catch (error) {
    // Handle duplicate email or phone error
    if (error.code === 11000) {
      console.warn(`[CASH-USER] Duplicate key error. Trying to find existing user by phone`);

      // Try to find by phone first (primary identifier)
      user = await User.findOne({ phone, isDeleted: false });

      if (!user && email) {
        // If not found by phone and email provided, try by email
        user = await User.findOne({ email, isDeleted: false });
      }

      if (user) {
        console.log(`[CASH-USER] Found existing user:`, {
          userId: user._id,
          name: user.name,
          email: user.email || '(no email)',
          phone: user.phone
        });
        return user;
      }
    }

    // If still failed, throw error
    console.error(`[CASH-USER] Failed to create/find user:`, error);
    throw error;
  }
};

/**
 * Send ticket notifications via WhatsApp and Email
 * Generates individual QR codes, uploads to Cloudinary, and sends:
 * - WhatsApp messages to ALL ticket holders (required)
 * - Emails ONLY to ticket holders who have email addresses (optional)
 *
 * @param {Object} enrollment - Enrollment document from database
 * @param {Object} buyerUser - Buyer user document
 * @param {Object} buyerDetails - Buyer details from request
 * @param {Array<Object>} otherUsers - Array of other ticket holder users with details
 * @param {Object} event - Event document from database
 *
 * @returns {Promise<void>}
 * @private
 */
const sendTicketEmails = async (enrollment, buyerUser, buyerDetails, otherUsers, event) => {
  try {
    const totalTicketHolders = 1 + otherUsers.length;
    console.log(`[CASH-NOTIFY] Preparing ticket notifications for ${totalTicketHolders} ticket holder(s)`);

    const emails = [];
    const whatsappMessages = [];
    const eventName = event.name || 'Event';
    const eventDate = event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : '';
    const eventLocation = event.city || '';

    // Process buyer's ticket
    try {
      console.log(`[CASH-NOTIFY] Processing buyer ticket for phone: ${buyerDetails.phone}`);

      // Generate QR code for buyer's ticket
      const buyerQRBuffer = await generateTicketQRCode({
        enrollmentId: enrollment._id.toString(),
        userId: buyerUser._id.toString(),
        eventId: enrollment.eventId.toString(),
        phone: buyerDetails.phone
      });

      const buyerQRFilename = generateQRFilename({
        eventName,
        phone: buyerDetails.phone
      });

      console.log(`[CASH-NOTIFY] ✓ Buyer QR code generated: ${buyerQRFilename} (${buyerQRBuffer.length} bytes)`);

      // Upload QR to Cloudinary for WhatsApp
      const buyerQRUrl = await uploadQRCodeToCloudinary({
        qrBuffer: buyerQRBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: buyerDetails.phone,
        eventName
      });

      // Add WhatsApp message for buyer (always)
      whatsappMessages.push({
        phone: buyerDetails.phone,
        name: buyerDetails.name,
        email: buyerDetails.email || '',
        eventName,
        qrCodeUrl: buyerQRUrl
      });

      console.log(`[CASH-NOTIFY] ✓ Buyer WhatsApp message queued`);

      // Add email for buyer only if email exists
      if (buyerDetails.email) {
        const buyerEmailData = {
          email: buyerDetails.email,
          phone: buyerDetails.phone,
          userId: buyerUser._id.toString(),
          eventId: enrollment.eventId.toString(),
          enrollmentId: enrollment._id.toString(),
          name: buyerDetails.name,
          eventName,
          eventDate,
          eventLocation,
          isBuyer: true
        };

        emails.push({
          to: buyerEmailData.email,
          subject: `Your Ticket - ${eventName}`,
          html: generateTicketEmail(buyerEmailData),
          text: generateTicketEmailText(buyerEmailData),
          attachments: [
            {
              filename: buyerQRFilename,
              content: buyerQRBuffer,
              contentType: 'image/png'
            }
          ]
        });

        console.log(`[CASH-NOTIFY] ✓ Buyer email queued (${buyerEmailData.email})`);
      } else {
        console.log(`[CASH-NOTIFY] ℹ Buyer has no email - skipping email notification`);
      }
    } catch (error) {
      console.error(`[CASH-NOTIFY] ✗ Failed to process buyer ticket: ${error.message}`);
    }

    // Process other ticket holders
    console.log(`[CASH-NOTIFY] Processing ${otherUsers.length} other ticket holder(s)`);
    for (const { user, details } of otherUsers) {
      try {
        console.log(`[CASH-NOTIFY] Processing ticket for phone: ${details.phone}`);

        // Generate QR code for this ticket holder
        const qrBuffer = await generateTicketQRCode({
          enrollmentId: enrollment._id.toString(),
          userId: user._id.toString(),
          eventId: enrollment.eventId.toString(),
          phone: details.phone
        });

        const qrFilename = generateQRFilename({
          eventName,
          phone: details.phone
        });

        console.log(`[CASH-NOTIFY] ✓ QR code generated for ${details.phone}: ${qrFilename} (${qrBuffer.length} bytes)`);

        // Upload QR to Cloudinary for WhatsApp
        const qrUrl = await uploadQRCodeToCloudinary({
          qrBuffer,
          enrollmentId: enrollment._id.toString(),
          phone: details.phone,
          eventName
        });

        // Add WhatsApp message (always)
        whatsappMessages.push({
          phone: details.phone,
          name: details.name,
          email: details.email || '',
          eventName,
          qrCodeUrl: qrUrl
        });

        console.log(`[CASH-NOTIFY] ✓ WhatsApp message queued for ${details.phone}`);

        // Add email only if email exists
        if (details.email) {
          const emailData = {
            email: details.email,
            phone: details.phone,
            userId: user._id.toString(),
            eventId: enrollment.eventId.toString(),
            enrollmentId: enrollment._id.toString(),
            name: details.name,
            eventName,
            eventDate,
            eventLocation,
            isBuyer: false
          };

          emails.push({
            to: emailData.email,
            subject: `Your Ticket - ${eventName}`,
            html: generateTicketEmail(emailData),
            text: generateTicketEmailText(emailData),
            attachments: [
              {
                filename: qrFilename,
                content: qrBuffer,
                contentType: 'image/png'
              }
            ]
          });

          console.log(`[CASH-NOTIFY] ✓ Email queued for ${details.email}`);
        } else {
          console.log(`[CASH-NOTIFY] ℹ ${details.phone} has no email - skipping email notification`);
        }
      } catch (error) {
        console.error(`[CASH-NOTIFY] ✗ Failed to process ticket for ${details.phone}: ${error.message}`);
      }
    }

    // Summary
    console.log(`[CASH-NOTIFY] === Notification Summary ===`);
    console.log(`[CASH-NOTIFY] WhatsApp messages queued: ${whatsappMessages.length}`);
    console.log(`[CASH-NOTIFY] Email messages queued: ${emails.length}`);

    // Send WhatsApp messages (to all ticket holders)
    if (whatsappMessages.length > 0) {
      try {
        console.log(`[CASH-NOTIFY] Sending ${whatsappMessages.length} WhatsApp message(s)...`);
        await sendBulkTicketWhatsApp(whatsappMessages);
        console.log('[CASH-NOTIFY] ✓ WhatsApp notifications sent successfully');
      } catch (whatsappError) {
        console.error(`[CASH-NOTIFY] ✗ WhatsApp sending failed: ${whatsappError.message}`);
        // Continue with emails even if WhatsApp fails
      }
    }

    // Send emails (only to those with email addresses)
    if (emails.length > 0) {
      try {
        console.log(`[CASH-NOTIFY] Sending ${emails.length} email(s)...`);
        await sendBulkEmails(emails);
        console.log('[CASH-NOTIFY] ✓ Email notifications sent successfully');
      } catch (emailError) {
        console.error(`[CASH-NOTIFY] ✗ Email sending failed: ${emailError.message}`);
      }
    } else {
      console.log('[CASH-NOTIFY] ℹ No emails to send (no ticket holders have email addresses)');
    }

    console.log('[CASH-NOTIFY] ✓ Notification process completed');

  } catch (error) {
    console.error(`[CASH-NOTIFY] ✗ Error in notification process: ${error.message}`);
    console.error(`[CASH-NOTIFY] Error stack:`, error.stack);
    // Don't throw error - order should still succeed even if notifications fail
  }
};

/**
 * Generate a unique 6-digit partner code
 * Ensures the code doesn't already exist in the database
 *
 * @returns {Promise<string>} Unique 6-digit code
 * @private
 */
const generateUniquePartnerCode = async () => {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate random 6-digit number
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if code already exists
    const existingPartner = await CashPartner.findOne({ partnerCode: code });

    if (!existingPartner) {
      console.log(`[PARTNER-CODE] Generated unique code: ${code}`);
      return code;
    }

    attempts++;
    console.log(`[PARTNER-CODE] Code ${code} already exists, retrying... (${attempts}/${maxAttempts})`);
  }

  throw new Error('Failed to generate unique partner code after maximum attempts');
};

/**
 * @typedef {Object} CreatePartnerRequest
 * @property {string} name - Partner name
 * @property {string} phone - Partner phone number
 */

/**
 * @typedef {Object} CreatePartnerResponse
 * @property {number} status - HTTP status code (201)
 * @property {string} message - Success message
 * @property {Object} data - Response data
 * @property {string} data._id - Partner ID
 * @property {string} data.name - Partner name
 * @property {string} data.phone - Partner phone number
 * @property {string} data.partnerCode - Generated 6-digit partner code
 */

/**
 * Create a new cash partner with auto-generated unique code
 * Automatically generates a unique 6-digit partner code
 *
 * @route POST /api/web/cash/partner
 * @access Public (should be protected with authentication in production)
 *
 * @param {import('express').Request} req - Express request object
 * @param {CreatePartnerRequest} req.body - Cash partner creation data
 *
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<CreatePartnerResponse>} JSON response with partner details
 *
 * @throws {400} Bad Request - If validation fails
 * @throws {409} Conflict - If phone number already exists
 * @throws {500} Internal Server Error - If partner creation fails
 *
 * @description
 * This endpoint creates a new cash partner record with an automatically generated
 * unique 6-digit code. The partner code is used to identify and authenticate
 * cash partners when processing cash orders.
 *
 * @example
 * POST /api/web/cash/partner
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "name": "Downtown Store",
 *   "phone": "+919876543210"
 * }
 *
 * Response (201 Created):
 * {
 *   "status": 201,
 *   "message": "Cash partner created successfully",
 *   "error": null,
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "name": "Downtown Store",
 *     "phone": "+919876543210",
 *     "partnerCode": "123456",
 *     "eventEnrollments": [],
 *     "createdAt": "2025-11-26T10:30:00.000Z",
 *     "updatedAt": "2025-11-26T10:30:00.000Z"
 *   }
 * }
 */
export const createCashPartner = async (req, res) => {
  try {
    console.log('=== Create Cash Partner Request Received ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { name, phone } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return responseUtil.badRequest(res, 'Partner name and phone are required');
    }

    // Validate name length
    if (name.length < 2 || name.length > 100) {
      return responseUtil.badRequest(res, 'Partner name must be between 2 and 100 characters');
    }

    // Validate phone length
    if (phone.length < 10 || phone.length > 15) {
      return responseUtil.badRequest(res, 'Phone number must be between 10 and 15 digits');
    }

    // Check if partner with this phone already exists
    const existingPartner = await CashPartner.findOne({ phone: phone.trim() });
    if (existingPartner) {
      return responseUtil.conflict(res, 'A partner with this phone number already exists', {
        existingPartner: {
          _id: existingPartner._id,
          name: existingPartner.name,
          partnerCode: existingPartner.partnerCode
        }
      });
    }

    // Generate unique 6-digit partner code
    const partnerCode = await generateUniquePartnerCode();

    // Create new cash partner
    const cashPartner = new CashPartner({
      name: name.trim(),
      phone: phone.trim(),
      partnerCode,
      eventEnrollments: []
    });

    await cashPartner.save();

    console.log('[CASH-PARTNER] Partner created successfully:', {
      partnerId: cashPartner._id,
      name: cashPartner.name,
      partnerCode: cashPartner.partnerCode,
      phone: cashPartner.phone
    });

    console.log('=== Cash Partner Creation Complete ===\n');

    return responseUtil.created(res, 'Cash partner created successfully', {
      _id: cashPartner._id,
      name: cashPartner.name,
      phone: cashPartner.phone,
      partnerCode: cashPartner.partnerCode,
      eventEnrollments: cashPartner.eventEnrollments,
      createdAt: cashPartner.createdAt,
      updatedAt: cashPartner.updatedAt
    });

  } catch (error) {
    console.error('[CASH-PARTNER] Error creating cash partner:', error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return responseUtil.validationError(res, 'Validation failed', messages);
    }

    // Handle duplicate key errors (should be caught by earlier check, but just in case)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return responseUtil.conflict(res, `A partner with this ${field} already exists`);
    }

    return responseUtil.internalError(res, 'Failed to create cash partner', error.message);
  }
};

export default {
  createCashOrder,
  createCashPartner
};
