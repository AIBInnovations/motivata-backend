/**
 * @fileoverview Ticket Reshare controller for admin ticket management
 * Allows admins to view all ticket holders and reshare tickets
 * @module controllers/ticketReshare
 */

import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import CashEventEnrollment from '../../schema/CashEventEnrollment.schema.js';
import Event from '../../schema/Event.schema.js';
import User from '../../schema/User.schema.js';
import responseUtil from '../../utils/response.util.js';
import { sendBulkEmails } from '../../utils/email.util.js';
import { sendTicketWhatsApp } from '../../utils/whatsapp.util.js';
import {
  generateTicketQRCode,
  generateQRFilename,
  uploadQRCodeToCloudinary
} from '../../utils/qrcode.util.js';
import {
  generateTicketImage,
  generateTicketFilename,
  uploadTicketImageToCloudinary
} from '../../utils/ticketImage.util.js';
import {
  generateTicketEmail,
  generateTicketEmailText
} from '../../utils/emailTemplate.util.js';

/**
 * Helper to normalize phone numbers (extract last 10 digits)
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number
 */
const normalizePhone = (phone) => {
  if (phone && phone.length > 10) {
    return phone.slice(-10);
  }
  return phone;
};

/**
 * Get all ticket holders for an event (Admin only)
 * Returns both online (EventEnrollment) and offline (CashEventEnrollment) tickets
 *
 * @route GET /api/web/tickets/reshare/list/:eventId
 * @access Admin
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with list of ticket holders
 */
export const getTicketHolders = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      page = 1,
      limit = 20,
      search,
      enrollmentType,
      scannedStatus
    } = req.query;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const ticketHolders = [];

    // ============ FETCH ONLINE EVENT ENROLLMENTS ============
    if (!enrollmentType || enrollmentType === 'ONLINE') {
      const onlineEnrollments = await EventEnrollment.find({ eventId })
        .populate('userId', 'name email phone')
        .lean();

      for (const enrollment of onlineEnrollments) {
        if (!enrollment.tickets) continue;

        // Convert tickets Map to entries
        const ticketsEntries = enrollment.tickets instanceof Map
          ? Array.from(enrollment.tickets.entries())
          : Object.entries(enrollment.tickets);

        for (const [phone, ticketData] of ticketsEntries) {
          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const userName = enrollment.userId?.name?.toLowerCase() || '';
            const userEmail = enrollment.userId?.email?.toLowerCase() || '';
            if (!phone.includes(search) && !userName.includes(searchLower) && !userEmail.includes(searchLower)) {
              continue;
            }
          }

          // Apply scanned status filter
          if (scannedStatus !== undefined) {
            const isScanned = scannedStatus === 'true';
            if (ticketData.isTicketScanned !== isScanned) {
              continue;
            }
          }

          ticketHolders.push({
            enrollmentType: 'ONLINE',
            enrollmentId: enrollment._id,
            orderId: enrollment.orderId,
            phone: phone,
            user: enrollment.userId,
            tierName: enrollment.tierName,
            ticketPrice: enrollment.ticketPrice,
            status: ticketData.status,
            isTicketScanned: ticketData.isTicketScanned || false,
            ticketScannedAt: ticketData.ticketScannedAt || null,
            ticketScannedBy: ticketData.ticketScannedBy || null,
            createdAt: enrollment.createdAt
          });
        }
      }
    }

    // ============ FETCH CASH EVENT ENROLLMENTS ============
    if (!enrollmentType || enrollmentType === 'CASH') {
      let cashQuery = { eventId };

      // Apply scanned status filter
      if (scannedStatus !== undefined) {
        cashQuery.isTicketScanned = scannedStatus === 'true';
      }

      let cashEnrollments = await CashEventEnrollment.find(cashQuery)
        .populate('userId', 'name email phone')
        .populate('offlineCashId', 'priceCharged signature generatedBy')
        .lean();

      // Apply search filter for cash enrollments
      if (search) {
        const searchLower = search.toLowerCase();
        cashEnrollments = cashEnrollments.filter(enrollment => {
          const userName = enrollment.name?.toLowerCase() || '';
          const userEmail = enrollment.userId?.email?.toLowerCase() || '';
          return enrollment.phone.includes(search) ||
            userName.includes(searchLower) ||
            userEmail.includes(searchLower);
        });
      }

      for (const enrollment of cashEnrollments) {
        ticketHolders.push({
          enrollmentType: 'CASH',
          enrollmentId: enrollment._id,
          offlineCashId: enrollment.offlineCashId?._id,
          phone: enrollment.phone,
          name: enrollment.name,
          user: enrollment.userId,
          priceCharged: enrollment.offlineCashId?.priceCharged || 0,
          status: enrollment.status,
          isTicketScanned: enrollment.isTicketScanned || false,
          ticketScannedAt: enrollment.ticketScannedAt || null,
          ticketScannedBy: enrollment.ticketScannedBy || null,
          ticketLink: enrollment.ticketLink,
          createdAt: enrollment.createdAt
        });
      }
    }

    // Sort by createdAt descending (newest first)
    ticketHolders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const totalCount = ticketHolders.length;
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const paginatedResults = ticketHolders.slice(skip, skip + parseInt(limit));

    // Get statistics
    const statistics = {
      total: ticketHolders.length,
      online: ticketHolders.filter(t => t.enrollmentType === 'ONLINE').length,
      cash: ticketHolders.filter(t => t.enrollmentType === 'CASH').length,
      scanned: ticketHolders.filter(t => t.isTicketScanned).length,
      notScanned: ticketHolders.filter(t => !t.isTicketScanned).length,
      active: ticketHolders.filter(t => t.status === 'ACTIVE').length,
      cancelled: ticketHolders.filter(t => t.status === 'CANCELLED').length
    };

    return responseUtil.success(res, 'Ticket holders retrieved successfully', {
      event: {
        _id: event._id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate
      },
      ticketHolders: paginatedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      },
      statistics
    });

  } catch (error) {
    console.error('[RESHARE] Error getting ticket holders:', error);
    return responseUtil.internalError(res, 'Failed to retrieve ticket holders', error.message);
  }
};

/**
 * Reshare a ticket - Reset scan fields and resend QR via WhatsApp/Email
 *
 * @route POST /api/web/tickets/reshare/:enrollmentType/:enrollmentId
 * @access Admin
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with reshare result
 */
export const reshareTicket = async (req, res) => {
  try {
    const { enrollmentType, enrollmentId } = req.params;
    const { phone, sendVia = 'both' } = req.body;
    // sendVia: 'whatsapp', 'email', 'both'

    console.log('[RESHARE] ========== STARTING TICKET RESHARE ==========');
    console.log('[RESHARE] Enrollment Type:', enrollmentType);
    console.log('[RESHARE] Enrollment ID:', enrollmentId);
    console.log('[RESHARE] Phone:', phone);
    console.log('[RESHARE] Send Via:', sendVia);

    let enrollment;
    let event;
    let user;
    let ticketData;
    let normalizedPhone;

    if (enrollmentType === 'ONLINE') {
      // Handle online EventEnrollment
      enrollment = await EventEnrollment.findById(enrollmentId)
        .populate('eventId')
        .populate('userId', 'name email phone');

      if (!enrollment) {
        return responseUtil.notFound(res, 'Enrollment not found');
      }

      if (!phone) {
        return responseUtil.badRequest(res, 'Phone number is required for online enrollments');
      }

      normalizedPhone = normalizePhone(phone);
      event = enrollment.eventId;
      user = enrollment.userId;

      // Find the ticket in the tickets Map
      const tickets = enrollment.tickets instanceof Map
        ? enrollment.tickets
        : new Map(Object.entries(enrollment.tickets || {}));

      // Try to find with various phone formats
      const phoneVariations = [phone, normalizedPhone, `+91${normalizedPhone}`, `91${normalizedPhone}`];
      let matchedPhone = null;

      for (const variation of phoneVariations) {
        if (tickets.has(variation)) {
          matchedPhone = variation;
          ticketData = tickets.get(variation);
          break;
        }
      }

      if (!ticketData) {
        return responseUtil.notFound(res, `Ticket for phone ${phone} not found in enrollment`);
      }

      // Reset scan-related fields
      ticketData.isTicketScanned = false;
      ticketData.ticketScannedAt = null;
      ticketData.ticketScannedBy = null;

      // Update the ticket in the Map
      tickets.set(matchedPhone, ticketData);
      enrollment.tickets = tickets;
      await enrollment.save();

      console.log('[RESHARE] Online ticket scan fields reset for phone:', matchedPhone);

    } else if (enrollmentType === 'CASH') {
      // Handle cash CashEventEnrollment
      enrollment = await CashEventEnrollment.findById(enrollmentId)
        .populate('eventId')
        .populate('userId', 'name email phone');

      if (!enrollment) {
        return responseUtil.notFound(res, 'Cash enrollment not found');
      }

      normalizedPhone = enrollment.phone;
      event = enrollment.eventId;
      user = enrollment.userId;
      ticketData = enrollment;

      // Reset scan-related fields
      enrollment.isTicketScanned = false;
      enrollment.ticketScannedAt = null;
      enrollment.ticketScannedBy = null;
      await enrollment.save();

      console.log('[RESHARE] Cash ticket scan fields reset for phone:', normalizedPhone);

    } else {
      return responseUtil.badRequest(res, 'Invalid enrollment type. Must be ONLINE or CASH');
    }

    // Verify event exists
    if (!event) {
      return responseUtil.notFound(res, 'Event not found for enrollment');
    }

    // Generate QR code URL for the ticket
    const qrScanUrl = enrollmentType === 'ONLINE'
      ? `https://motivata.synquic.com/api/app/tickets/qr-scan?enrollmentId=${enrollment._id.toString()}&userId=${user._id.toString()}&eventId=${event._id.toString()}&phone=${normalizedPhone}`
      : `https://motivata.synquic.com/api/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id.toString()}&userId=${user._id.toString()}&eventId=${event._id.toString()}&phone=${normalizedPhone}`;

    console.log('[RESHARE] QR Scan URL:', qrScanUrl);

    // Generate ticket image or QR code
    let ticketBuffer;
    let ticketUrl;
    let ticketFilename;
    const eventName = event.name || event.title || 'Event';

    try {
      // Try to generate ticket image with embedded QR code
      ticketBuffer = await generateTicketImage({
        qrData: qrScanUrl,
        eventName,
        eventMode: event.mode || 'OFFLINE',
        eventLocation: event.location || event.city || '',
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        ticketCount: 1,
        ticketPrice: enrollment.ticketPrice || enrollment.priceCharged || event.price || '',
        venueName: event.venue || event.location || '',
        bookingId: enrollment._id.toString()
      });

      ticketFilename = generateTicketFilename({
        eventName,
        phone: normalizedPhone
      });

      console.log(`[RESHARE] ✓ Ticket image generated: ${ticketFilename} (${ticketBuffer.length} bytes)`);

      // Upload ticket image to Cloudinary
      ticketUrl = await uploadTicketImageToCloudinary({
        imageBuffer: ticketBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: normalizedPhone,
        eventName
      });

    } catch (ticketImageErr) {
      // Fallback to QR-only if ticket image generation fails
      console.log(`[RESHARE] Ticket image FAILED, falling back to QR-only: ${ticketImageErr.message}`);

      ticketBuffer = await generateTicketQRCode({
        enrollmentId: enrollment._id.toString(),
        userId: user._id.toString(),
        eventId: event._id.toString(),
        phone: normalizedPhone
      });

      ticketFilename = generateQRFilename({
        eventName,
        phone: normalizedPhone
      });

      ticketUrl = await uploadQRCodeToCloudinary({
        qrBuffer: ticketBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: normalizedPhone,
        eventName
      });

      console.log(`[RESHARE] ✓ QR code fallback uploaded: ${ticketUrl}`);
    }

    // Prepare notification results
    const notificationResults = {
      whatsapp: { sent: false, error: null },
      email: { sent: false, error: null }
    };

    // Get user details for notifications
    const userName = enrollmentType === 'CASH'
      ? enrollment.name
      : user?.name || 'Customer';
    const userEmail = user?.email;

    // Send WhatsApp if requested
    if (sendVia === 'whatsapp' || sendVia === 'both') {
      try {
        console.log(`[RESHARE] Sending WhatsApp to ${normalizedPhone}...`);
        const whatsappResult = await sendTicketWhatsApp({
          phone: normalizedPhone,
          name: userName,
          email: userEmail || '',
          eventName,
          qrCodeUrl: ticketUrl,
          eventId: event._id.toString(),
          orderId: enrollment.orderId || enrollment._id.toString(),
          userId: user._id.toString(),
          enrollmentId: enrollment._id.toString()
        });
        notificationResults.whatsapp = { sent: true, messageId: whatsappResult.messageId };
        console.log(`[RESHARE] ✓ WhatsApp sent successfully`);
      } catch (whatsappError) {
        console.error(`[RESHARE] ✗ WhatsApp failed: ${whatsappError.message}`);
        notificationResults.whatsapp = { sent: false, error: whatsappError.message };
      }
    }

    // Send Email if requested and user has email
    if ((sendVia === 'email' || sendVia === 'both') && userEmail) {
      try {
        console.log(`[RESHARE] Sending email to ${userEmail}...`);

        const eventDate = event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : '';

        const emailData = {
          email: userEmail,
          phone: normalizedPhone,
          userId: user._id.toString(),
          eventId: event._id.toString(),
          enrollmentId: enrollment._id.toString(),
          name: userName,
          eventName,
          eventDate,
          eventLocation: event.location || event.city || '',
          isBuyer: true
        };

        await sendBulkEmails([{
          to: userEmail,
          subject: `Your Ticket - ${eventName} (Reshared)`,
          html: generateTicketEmail(emailData),
          text: generateTicketEmailText(emailData),
          attachments: [{
            filename: ticketFilename,
            content: ticketBuffer,
            contentType: 'image/png'
          }],
          category: 'TICKET_RESHARE',
          eventId: event._id.toString(),
          orderId: enrollment.orderId || enrollment._id.toString(),
          userId: user._id.toString(),
          enrollmentId: enrollment._id.toString()
        }]);

        notificationResults.email = { sent: true };
        console.log(`[RESHARE] ✓ Email sent successfully`);
      } catch (emailError) {
        console.error(`[RESHARE] ✗ Email failed: ${emailError.message}`);
        notificationResults.email = { sent: false, error: emailError.message };
      }
    } else if ((sendVia === 'email' || sendVia === 'both') && !userEmail) {
      notificationResults.email = { sent: false, error: 'No email address available' };
    }

    console.log('[RESHARE] ========== TICKET RESHARE COMPLETE ==========');

    return responseUtil.success(res, 'Ticket reshared successfully', {
      enrollmentType,
      enrollmentId,
      phone: normalizedPhone,
      scanFieldsReset: true,
      ticketUrl,
      notifications: notificationResults
    });

  } catch (error) {
    console.error('[RESHARE] Error resharing ticket:', error);
    return responseUtil.internalError(res, 'Failed to reshare ticket', error.message);
  }
};

/**
 * Bulk reshare tickets for an event
 * Reset scan fields and resend QR for multiple tickets
 *
 * @route POST /api/web/tickets/reshare/bulk
 * @access Admin
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with bulk reshare results
 */
export const bulkReshareTickets = async (req, res) => {
  try {
    const { tickets, sendVia = 'whatsapp' } = req.body;
    // tickets: [{ enrollmentType: 'ONLINE'|'CASH', enrollmentId: string, phone?: string }]

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return responseUtil.badRequest(res, 'Tickets array is required');
    }

    if (tickets.length > 50) {
      return responseUtil.badRequest(res, 'Maximum 50 tickets can be reshared at once');
    }

    console.log(`[BULK-RESHARE] Starting bulk reshare for ${tickets.length} tickets`);

    const results = [];

    for (const ticket of tickets) {
      try {
        const { enrollmentType, enrollmentId, phone } = ticket;

        // Create a mock request/response to reuse reshareTicket logic
        let enrollment;
        let event;
        let user;
        let ticketData;
        let normalizedPhone;

        if (enrollmentType === 'ONLINE') {
          enrollment = await EventEnrollment.findById(enrollmentId)
            .populate('eventId')
            .populate('userId', 'name email phone');

          if (!enrollment) {
            results.push({ enrollmentId, success: false, error: 'Enrollment not found' });
            continue;
          }

          normalizedPhone = normalizePhone(phone);
          event = enrollment.eventId;
          user = enrollment.userId;

          const tickets = enrollment.tickets instanceof Map
            ? enrollment.tickets
            : new Map(Object.entries(enrollment.tickets || {}));

          const phoneVariations = [phone, normalizedPhone, `+91${normalizedPhone}`, `91${normalizedPhone}`];
          let matchedPhone = null;

          for (const variation of phoneVariations) {
            if (tickets.has(variation)) {
              matchedPhone = variation;
              ticketData = tickets.get(variation);
              break;
            }
          }

          if (!ticketData) {
            results.push({ enrollmentId, phone, success: false, error: 'Ticket not found' });
            continue;
          }

          // Reset scan fields
          ticketData.isTicketScanned = false;
          ticketData.ticketScannedAt = null;
          ticketData.ticketScannedBy = null;
          tickets.set(matchedPhone, ticketData);
          enrollment.tickets = tickets;
          await enrollment.save();

        } else if (enrollmentType === 'CASH') {
          enrollment = await CashEventEnrollment.findById(enrollmentId)
            .populate('eventId')
            .populate('userId', 'name email phone');

          if (!enrollment) {
            results.push({ enrollmentId, success: false, error: 'Enrollment not found' });
            continue;
          }

          normalizedPhone = enrollment.phone;
          event = enrollment.eventId;
          user = enrollment.userId;

          // Reset scan fields
          enrollment.isTicketScanned = false;
          enrollment.ticketScannedAt = null;
          enrollment.ticketScannedBy = null;
          await enrollment.save();
        }

        // Generate and send ticket (simplified for bulk)
        const eventName = event.name || event.title || 'Event';
        const qrScanUrl = enrollmentType === 'ONLINE'
          ? `https://motivata.synquic.com/api/app/tickets/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${event._id}&phone=${normalizedPhone}`
          : `https://motivata.synquic.com/api/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${event._id}&phone=${normalizedPhone}`;

        // Generate QR code (simpler for bulk operations)
        const ticketBuffer = await generateTicketQRCode({
          enrollmentId: enrollment._id.toString(),
          userId: user._id.toString(),
          eventId: event._id.toString(),
          phone: normalizedPhone
        });

        const ticketUrl = await uploadQRCodeToCloudinary({
          qrBuffer: ticketBuffer,
          enrollmentId: enrollment._id.toString(),
          phone: normalizedPhone,
          eventName
        });

        // Send WhatsApp
        if (sendVia === 'whatsapp' || sendVia === 'both') {
          try {
            await sendTicketWhatsApp({
              phone: normalizedPhone,
              name: enrollmentType === 'CASH' ? enrollment.name : user?.name || 'Customer',
              eventName,
              qrCodeUrl: ticketUrl,
              eventId: event._id.toString(),
              enrollmentId: enrollment._id.toString()
            });
          } catch (err) {
            console.error(`[BULK-RESHARE] WhatsApp failed for ${normalizedPhone}:`, err.message);
          }
        }

        results.push({
          enrollmentId,
          enrollmentType,
          phone: normalizedPhone,
          success: true
        });

      } catch (ticketError) {
        results.push({
          enrollmentId: ticket.enrollmentId,
          success: false,
          error: ticketError.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[BULK-RESHARE] Complete: ${successCount} success, ${failedCount} failed`);

    return responseUtil.success(res, `Bulk reshare complete: ${successCount} succeeded, ${failedCount} failed`, {
      results,
      summary: {
        total: tickets.length,
        success: successCount,
        failed: failedCount
      }
    });

  } catch (error) {
    console.error('[BULK-RESHARE] Error:', error);
    return responseUtil.internalError(res, 'Failed to bulk reshare tickets', error.message);
  }
};

export default {
  getTicketHolders,
  reshareTicket,
  bulkReshareTickets
};
