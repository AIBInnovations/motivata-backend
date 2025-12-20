/**
 * @fileoverview Direct Ticket controller for bypassing redemption flow
 * Creates OfflineCash (redeemed=true) and CashEventEnrollment directly
 * @module controllers/directTicket
 */

import * as XLSX from "xlsx";
import OfflineCash from "../../schema/OfflineCash.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import responseUtil from "../../utils/response.util.js";
import { sendTicketWhatsApp } from "../../utils/whatsapp.util.js";
import { uploadQRCodeToCloudinary } from "../../utils/qrcode.util.js";
import { generateTicketImage, uploadTicketImageToCloudinary } from "../../utils/ticketImage.util.js";
import bcrypt from "bcrypt";

const BASE_URL = process.env.BASE_URL || "https://motivata.synquic.com/api";

/**
 * Check if admin has access to event
 */
const checkEventAccess = async (adminId, eventId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return false;

  if (admin.role === "SUPER_ADMIN" || admin.role === "ADMIN") {
    return true;
  }

  if (admin.role === "MANAGEMENT_STAFF") {
    return admin.allowedEvents.some(
      (id) => id.toString() === eventId.toString()
    );
  }

  return false;
};

/**
 * Validate a single phone number against all existing records
 * Returns rejection reason or null if valid
 */
const validatePhoneForEvent = async (phone, eventId) => {
  const normalizedPhone = phone.slice(-10);

  // 1. Check for unredeemed OfflineCash record
  const unredeemedOfflineCash = await OfflineCash.findOne({
    eventId,
    generatedFor: normalizedPhone,
    redeemed: false,
  });
  if (unredeemedOfflineCash) {
    return {
      reason: "Has unredeemed offline cash record",
      type: "UNREDEEMED_OFFLINE_CASH",
      details: {
        offlineCashId: unredeemedOfflineCash._id,
        signature: unredeemedOfflineCash.signature,
        ticketCount: unredeemedOfflineCash.ticketCount,
        createdAt: unredeemedOfflineCash.createdAt,
      },
    };
  }

  // 2. Check for redeemed OfflineCash record (already has ticket)
  const redeemedOfflineCash = await OfflineCash.findOne({
    eventId,
    generatedFor: normalizedPhone,
    redeemed: true,
  });
  if (redeemedOfflineCash) {
    return {
      reason: "Has redeemed offline cash record",
      type: "REDEEMED_OFFLINE_CASH",
      details: {
        offlineCashId: redeemedOfflineCash._id,
        signature: redeemedOfflineCash.signature,
        ticketCount: redeemedOfflineCash.ticketCount,
        redeemedAt: redeemedOfflineCash.redeemedAt,
      },
    };
  }

  // 3. Check for CashEventEnrollment record
  const cashEnrollment = await CashEventEnrollment.findOne({
    eventId,
    phone: normalizedPhone,
  });
  if (cashEnrollment) {
    return {
      reason: "Already has cash enrollment",
      type: "CASH_ENROLLMENT_EXISTS",
      details: {
        enrollmentId: cashEnrollment._id,
        name: cashEnrollment.name,
        status: cashEnrollment.status,
        createdAt: cashEnrollment.createdAt,
      },
    };
  }

  // 4. Check for EventEnrollment by userId
  const user = await User.findOne({ phone: normalizedPhone });
  if (user) {
    const eventEnrollment = await EventEnrollment.findOne({
      eventId,
      userId: user._id,
    });
    if (eventEnrollment) {
      return {
        reason: "Already has online enrollment",
        type: "ONLINE_ENROLLMENT_EXISTS",
        details: {
          enrollmentId: eventEnrollment._id,
          orderId: eventEnrollment.orderId,
          ticketCount: eventEnrollment.ticketCount,
          createdAt: eventEnrollment.createdAt,
        },
      };
    }
  }

  // 5. Check if phone exists in tickets field of any EventEnrollment
  const enrollmentWithPhone = await EventEnrollment.findOne({
    eventId,
    [`tickets.${normalizedPhone}`]: { $exists: true },
  });
  if (enrollmentWithPhone) {
    const ticketInfo = enrollmentWithPhone.tickets.get(normalizedPhone);
    return {
      reason: "Phone exists in another enrollment tickets",
      type: "TICKET_EXISTS_IN_ENROLLMENT",
      details: {
        enrollmentId: enrollmentWithPhone._id,
        orderId: enrollmentWithPhone.orderId,
        ticketStatus: ticketInfo?.status,
        bookedBy: enrollmentWithPhone.userId,
      },
    };
  }

  return null; // Valid
};

/**
 * Create direct ticket for a single attendee
 * POST /api/web/offline-cash/direct-ticket
 */
export const createDirectTicket = async (req, res) => {
  try {
    const { eventId, phone, name, priceCharged, notes } = req.body;
    const adminId = req.user.id;

    console.log(`[DIRECT_TICKET] Single request: phone=${phone}, eventId=${eventId}`);

    // Validate phone format
    if (!phone || !/^\d{10,15}$/.test(phone)) {
      return responseUtil.badRequest(res, "Invalid phone number format");
    }

    const normalizedPhone = phone.slice(-10);

    // Check event access
    const hasAccess = await checkEventAccess(adminId, eventId);
    if (!hasAccess) {
      return responseUtil.forbidden(res, "You do not have access to this event");
    }

    // Check event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Validate phone against existing records
    const rejection = await validatePhoneForEvent(normalizedPhone, eventId);
    if (rejection) {
      console.log(`[DIRECT_TICKET] Rejected: phone=${normalizedPhone}, reason=${rejection.reason}`);
      return responseUtil.badRequest(res, rejection.reason, {
        type: rejection.type,
        details: rejection.details,
      });
    }

    // Create or find user
    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      const hashedPassword = await bcrypt.hash(normalizedPhone, 10);
      user = await User.create({
        name: name,
        phone: normalizedPhone,
        password: hashedPassword,
      });
      console.log(`[DIRECT_TICKET] Created user: ${normalizedPhone}`);
    }

    // Generate signature
    const signature = await OfflineCash.generateSignature();
    const link = `${BASE_URL}/app/tickets/redeem?phone=${normalizedPhone}&sign=${signature}`;

    // Create OfflineCash record (already redeemed)
    const offlineCash = await OfflineCash.create({
      eventId,
      generatedFor: normalizedPhone,
      ticketCount: 1,
      signature,
      priceCharged: priceCharged || 0,
      link,
      notes: notes || "Direct ticket",
      generatedBy: adminId,
      redeemed: true,
      redeemedAt: new Date(),
    });

    console.log(`[DIRECT_TICKET] OfflineCash created: ${offlineCash._id}`);

    // Create CashEventEnrollment
    const ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=PLACEHOLDER&userId=${user._id}&eventId=${eventId}&phone=${normalizedPhone}`;

    const enrollment = await CashEventEnrollment.create({
      eventId,
      userId: user._id,
      offlineCashId: offlineCash._id,
      phone: normalizedPhone,
      name: name,
      ticketLink,
    });

    // Update ticket link with enrollment ID
    enrollment.ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${eventId}&phone=${normalizedPhone}`;
    await enrollment.save();

    console.log(`[DIRECT_TICKET] Enrollment created: ${enrollment._id}`);

    // Send ticket async (non-blocking)
    sendTicketAsync(enrollment, user, event, offlineCash.priceCharged).catch((err) => {
      console.error(`[DIRECT_TICKET] Ticket send error: ${err.message}`);
    });

    return responseUtil.created(res, "Direct ticket created successfully", {
      offlineCash: {
        id: offlineCash._id,
        signature: offlineCash.signature,
      },
      enrollment: {
        id: enrollment._id,
        phone: enrollment.phone,
        name: enrollment.name,
        ticketLink: enrollment.ticketLink,
      },
      event: {
        id: event._id,
        name: event.name,
      },
    });
  } catch (error) {
    console.error(`[DIRECT_TICKET] Error: ${error.message}`);
    return responseUtil.internalError(res, "Failed to create direct ticket", error.message);
  }
};

/**
 * Create direct tickets in bulk from Excel file
 * POST /api/web/offline-cash/direct-ticket-bulk
 */
export const createDirectTicketBulk = async (req, res) => {
  try {
    const { eventId, priceCharged, notes } = req.body;
    const adminId = req.user.id;

    console.log(`[DIRECT_TICKET_BULK] Request: eventId=${eventId}`);

    if (!req.file) {
      return responseUtil.badRequest(res, "Excel file is required");
    }

    // Check event access
    const hasAccess = await checkEventAccess(adminId, eventId);
    if (!hasAccess) {
      return responseUtil.forbidden(res, "You do not have access to this event");
    }

    // Check event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Parse Excel file
    let attendees;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      attendees = data.map((row, index) => ({
        rowNumber: index + 2, // Excel row (1-indexed, +1 for header)
        phone: String(row.phone || row.Phone || row.PHONE || row["Phone Number"] || row["phone number"] || "").trim(),
        name: String(row.name || row.Name || row.NAME || row["Full Name"] || row["full name"] || "").trim(),
      }));

      console.log(`[DIRECT_TICKET_BULK] Parsed ${attendees.length} rows from Excel`);
    } catch (parseError) {
      console.error(`[DIRECT_TICKET_BULK] Excel parse error: ${parseError.message}`);
      return responseUtil.badRequest(res, "Failed to parse Excel file", parseError.message);
    }

    if (attendees.length === 0) {
      return responseUtil.badRequest(res, "Excel file has no data rows");
    }

    // Process each attendee
    const results = {
      successful: [],
      rejected: [],
    };

    for (const attendee of attendees) {
      const { rowNumber, phone, name } = attendee;

      // Basic validation
      if (!phone) {
        results.rejected.push({
          rowNumber,
          phone: "",
          name,
          reason: "Phone number is missing",
          type: "VALIDATION_ERROR",
          details: null,
        });
        continue;
      }

      if (!name) {
        results.rejected.push({
          rowNumber,
          phone,
          name: "",
          reason: "Name is missing",
          type: "VALIDATION_ERROR",
          details: null,
        });
        continue;
      }

      // Normalize phone
      const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

      if (!/^\d{10}$/.test(normalizedPhone)) {
        results.rejected.push({
          rowNumber,
          phone,
          name,
          reason: "Invalid phone number format (must be 10 digits)",
          type: "VALIDATION_ERROR",
          details: null,
        });
        continue;
      }

      // Check for duplicates in current batch
      const duplicateInBatch = results.successful.find((s) => s.phone === normalizedPhone);
      if (duplicateInBatch) {
        results.rejected.push({
          rowNumber,
          phone: normalizedPhone,
          name,
          reason: "Duplicate phone in this batch",
          type: "DUPLICATE_IN_BATCH",
          details: { duplicateRow: duplicateInBatch.rowNumber },
        });
        continue;
      }

      // Validate against existing records
      const rejection = await validatePhoneForEvent(normalizedPhone, eventId);
      if (rejection) {
        results.rejected.push({
          rowNumber,
          phone: normalizedPhone,
          name,
          reason: rejection.reason,
          type: rejection.type,
          details: rejection.details,
        });
        continue;
      }

      // Create ticket
      try {
        // Create or find user
        let user = await User.findOne({ phone: normalizedPhone });
        if (!user) {
          const hashedPassword = await bcrypt.hash(normalizedPhone, 10);
          user = await User.create({
            name: name,
            phone: normalizedPhone,
            password: hashedPassword,
          });
        }

        // Generate signature
        const signature = await OfflineCash.generateSignature();
        const link = `${BASE_URL}/app/tickets/redeem?phone=${normalizedPhone}&sign=${signature}`;

        // Create OfflineCash (already redeemed)
        const offlineCash = await OfflineCash.create({
          eventId,
          generatedFor: normalizedPhone,
          ticketCount: 1,
          signature,
          priceCharged: priceCharged || 0,
          link,
          notes: notes || "Direct ticket (bulk)",
          generatedBy: adminId,
          redeemed: true,
          redeemedAt: new Date(),
        });

        // Create CashEventEnrollment
        const ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=PLACEHOLDER&userId=${user._id}&eventId=${eventId}&phone=${normalizedPhone}`;

        const enrollment = await CashEventEnrollment.create({
          eventId,
          userId: user._id,
          offlineCashId: offlineCash._id,
          phone: normalizedPhone,
          name: name,
          ticketLink,
        });

        enrollment.ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${eventId}&phone=${normalizedPhone}`;
        await enrollment.save();

        results.successful.push({
          rowNumber,
          phone: normalizedPhone,
          name,
          offlineCashId: offlineCash._id,
          enrollmentId: enrollment._id,
        });

        // Send ticket async
        sendTicketAsync(enrollment, user, event, offlineCash.priceCharged).catch((err) => {
          console.error(`[DIRECT_TICKET_BULK] Ticket send error for ${normalizedPhone}: ${err.message}`);
        });
      } catch (createError) {
        console.error(`[DIRECT_TICKET_BULK] Create error for ${normalizedPhone}: ${createError.message}`);
        results.rejected.push({
          rowNumber,
          phone: normalizedPhone,
          name,
          reason: "Failed to create ticket",
          type: "CREATE_ERROR",
          details: { error: createError.message },
        });
      }
    }

    console.log(`[DIRECT_TICKET_BULK] Complete: ${results.successful.length} created, ${results.rejected.length} rejected`);

    // Generate rejection Excel if there are rejections
    let rejectionExcelBuffer = null;
    if (results.rejected.length > 0) {
      rejectionExcelBuffer = generateRejectionExcel(results.rejected);
    }

    // Return response
    const response = {
      summary: {
        total: attendees.length,
        successful: results.successful.length,
        rejected: results.rejected.length,
      },
      successful: results.successful.map((s) => ({
        rowNumber: s.rowNumber,
        phone: s.phone,
        name: s.name,
      })),
      rejected: results.rejected,
      event: {
        id: event._id,
        name: event.name,
      },
    };

    // If there's a rejection file, send it as base64
    if (rejectionExcelBuffer) {
      response.rejectionFile = {
        filename: `rejected_tickets_${event.name.replace(/\s+/g, "_")}_${Date.now()}.xlsx`,
        base64: rejectionExcelBuffer.toString("base64"),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    return responseUtil.success(res, "Bulk direct ticket processing complete", response);
  } catch (error) {
    console.error(`[DIRECT_TICKET_BULK] Error: ${error.message}`);
    return responseUtil.internalError(res, "Failed to process bulk direct tickets", error.message);
  }
};

/**
 * Send ticket image via WhatsApp (async helper)
 */
const sendTicketAsync = async (enrollment, user, event, priceCharged) => {
  try {
    let imageUrl;
    try {
      const ticketBuffer = await generateTicketImage({
        qrData: enrollment.ticketLink,
        eventName: event.name,
        eventMode: event.mode || "OFFLINE",
        eventLocation: event.location || event.city || "",
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        ticketCount: 1,
        ticketPrice: priceCharged || event.price || "",
        venueName: event.venue || event.location || "",
        bookingId: enrollment._id.toString(),
      });

      imageUrl = await uploadTicketImageToCloudinary({
        imageBuffer: ticketBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: enrollment.phone,
        eventName: event.name,
      });
    } catch (ticketImageErr) {
      console.log(`[DIRECT_TICKET] Ticket image failed for ${enrollment.phone}, using QR fallback`);

      const QRCode = (await import("qrcode")).default;
      const qrBuffer = await QRCode.toBuffer(enrollment.ticketLink, {
        errorCorrectionLevel: "H",
        type: "png",
        width: 400,
        margin: 2,
      });

      imageUrl = await uploadQRCodeToCloudinary({
        qrBuffer,
        enrollmentId: enrollment._id.toString(),
        phone: enrollment.phone,
        eventName: event.name,
      });
    }

    await sendTicketWhatsApp({
      phone: enrollment.phone,
      name: enrollment.name,
      eventName: event.name,
      qrCodeUrl: imageUrl,
      eventId: event._id.toString(),
      userId: user._id.toString(),
      enrollmentId: enrollment._id.toString(),
    });

    console.log(`[DIRECT_TICKET] Ticket sent: ${enrollment.phone}`);
  } catch (err) {
    console.error(`[DIRECT_TICKET] Ticket send failed for ${enrollment.phone}: ${err.message}`);
    throw err;
  }
};

/**
 * Generate Excel file for rejected entries
 */
const generateRejectionExcel = (rejected) => {
  const data = rejected.map((r) => ({
    "Row Number": r.rowNumber,
    Phone: r.phone,
    Name: r.name,
    Reason: r.reason,
    "Rejection Type": r.type,
    Details: r.details ? JSON.stringify(r.details) : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rejected");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 12 }, // Row Number
    { wch: 15 }, // Phone
    { wch: 25 }, // Name
    { wch: 40 }, // Reason
    { wch: 25 }, // Rejection Type
    { wch: 50 }, // Details
  ];

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

export default {
  createDirectTicket,
  createDirectTicketBulk,
};
