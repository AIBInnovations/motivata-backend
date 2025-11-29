/**
 * @fileoverview Offline Cash controller for cash payment ticket management
 * @module controllers/offlineCash
 */

import OfflineCash from "../../schema/OfflineCash.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import Voucher from "../../schema/Voucher.Schema.js";
import responseUtil from "../../utils/response.util.js";
import { sendTicketWhatsApp, sendRedemptionLinkWhatsApp } from "../../utils/whatsapp.util.js";
import { uploadQRCodeToCloudinary } from "../../utils/qrcode.util.js";
import bcrypt from "bcrypt";
import QRCode from "qrcode";

const BASE_URL = process.env.BASE_URL || "https://motivata.synquic.com/api";

/**
 * Check if admin has access to event
 */
const checkEventAccess = async (adminId, eventId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return false;

  // Super admin and admin have access to all events
  if (admin.role === "SUPER_ADMIN" || admin.role === "ADMIN") {
    return true;
  }

  // Management staff can only access allowed events
  if (admin.role === "MANAGEMENT_STAFF") {
    return admin.allowedEvents.some(
      (id) => id.toString() === eventId.toString()
    );
  }

  return false;
};

/**
 * Generate offline cash record (Admin/Management Staff)
 * Admin inputs: phone, ticketCount, eventId, optional priceCharged/notes
 * Returns link for admin to give to customer directly
 */
export const createOfflineCash = async (req, res) => {
  try {
    const { eventId, phone, ticketCount, priceCharged, notes } = req.body;
    const adminId = req.user.id;

    // Normalize phone to 10 digits
    const normalizedPhone = phone.slice(-10);

    // Check event access
    const hasAccess = await checkEventAccess(adminId, eventId);
    if (!hasAccess) {
      return responseUtil.forbidden(
        res,
        "You do not have access to this event"
      );
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Check if already generated for this phone and event (not redeemed)
    const existing = await OfflineCash.findOne({
      eventId,
      generatedFor: normalizedPhone,
      redeemed: false,
    });
    if (existing) {
      return responseUtil.conflict(
        res,
        "Unredeemed ticket link already exists for this phone and event",
        { existingLink: existing.link, signature: existing.signature }
      );
    }

    // Generate unique signature
    const signature = await OfflineCash.generateSignature();

    // Generate link
    const link = `${BASE_URL}/app/tickets/redeem?phone=${normalizedPhone}&sign=${signature}`;

    // Create offline cash record
    const offlineCash = await OfflineCash.create({
      eventId,
      generatedFor: normalizedPhone,
      ticketCount,
      signature,
      priceCharged: priceCharged || 0,
      link,
      notes: notes || null,
      generatedBy: adminId,
    });

    // Send redemption link via WhatsApp (non-blocking)
    let whatsappStatus = { sent: false, error: null };
    try {
      const whatsappResult = await sendRedemptionLinkWhatsApp({
        phone: normalizedPhone,
        link: offlineCash.link,
      });
      whatsappStatus = { sent: true, messageId: whatsappResult.messageId };
    } catch (whatsappError) {
      console.error(
        `[OFFLINE_CASH] WhatsApp error for ${normalizedPhone}:`,
        whatsappError.message
      );
      whatsappStatus = { sent: false, error: whatsappError.message };
    }

    return responseUtil.created(res, "Offline cash record created", {
      id: offlineCash._id,
      link: offlineCash.link,
      signature: offlineCash.signature,
      phone: offlineCash.generatedFor,
      ticketCount: offlineCash.ticketCount,
      event: { id: event._id, name: event.name },
      whatsapp: whatsappStatus,
    });
  } catch (error) {
    console.error("Create offline cash error:", error);
    return responseUtil.internalError(
      res,
      "Failed to create offline cash record",
      error.message
    );
  }
};

/**
 * Get all offline cash records (Admin)
 */
export const getOfflineCashRecords = async (req, res) => {
  try {
    const { eventId, redeemed, page = 1, limit = 20 } = req.query;
    const adminId = req.user.id;

    const filter = {};

    if (eventId) {
      const hasAccess = await checkEventAccess(adminId, eventId);
      if (!hasAccess) {
        return responseUtil.forbidden(
          res,
          "You do not have access to this event"
        );
      }
      filter.eventId = eventId;
    }

    if (redeemed !== undefined) {
      filter.redeemed = redeemed === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      OfflineCash.find(filter)
        .populate("eventId", "name startDate")
        .populate("generatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      OfflineCash.countDocuments(filter),
    ]);

    return responseUtil.success(res, "Offline cash records fetched", {
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get offline cash records error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch records",
      error.message
    );
  }
};

/**
 * Get single offline cash record by ID (Admin)
 */
export const getOfflineCashById = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await OfflineCash.findById(id)
      .populate("eventId", "name startDate endDate")
      .populate("generatedBy", "name email");

    if (!record) {
      return responseUtil.notFound(res, "Record not found");
    }

    return responseUtil.success(res, "Record fetched", record);
  } catch (error) {
    console.error("Get offline cash by ID error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch record",
      error.message
    );
  }
};

/**
 * Delete offline cash record (Admin/Super Admin only)
 */
export const deleteOfflineCash = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const record = await OfflineCash.findById(id);
    if (!record) {
      return responseUtil.notFound(res, "Record not found");
    }

    if (record.redeemed) {
      return responseUtil.badRequest(
        res,
        "Cannot delete redeemed record"
      );
    }

    await record.softDelete(adminId);

    return responseUtil.success(res, "Record deleted successfully");
  } catch (error) {
    console.error("Delete offline cash error:", error);
    return responseUtil.internalError(
      res,
      "Failed to delete record",
      error.message
    );
  }
};

/**
 * Validate redemption link (Public - renders form for browser, returns JSON for API)
 */
export const validateRedemptionLink = async (req, res) => {
  try {
    const { phone, sign, format } = req.query;
    // Check if it's an API request (explicit JSON format or API client)
    const acceptHeader = req.get("Accept") || "";
    const isApiRequest =
      format === "json" ||
      acceptHeader.startsWith("application/json") ||
      req.xhr;
    const isBrowser = !isApiRequest;

    if (!phone || !sign) {
      if (isBrowser) {
        return res.status(400).render("error", {
          title: "Invalid Link",
          message: "Phone and signature are required",
        });
      }
      return responseUtil.badRequest(res, "Phone and signature are required");
    }

    const normalizedPhone = phone.slice(-10);

    const record = await OfflineCash.findOne({
      generatedFor: normalizedPhone,
      signature: sign,
    }).populate("eventId", "name startDate endDate");

    if (!record) {
      if (isBrowser) {
        return res.status(404).render("error", {
          title: "Invalid Link",
          message: "This link is invalid or has expired",
        });
      }
      return responseUtil.notFound(res, "Invalid or expired link");
    }

    if (record.redeemed) {
      if (isBrowser) {
        return res.status(400).render("error", {
          title: "Already Redeemed",
          message: "This link has already been used to redeem tickets",
        });
      }
      return responseUtil.badRequest(
        res,
        "This link has already been redeemed"
      );
    }

    // If browser request, render the EJS form
    if (isBrowser) {
      return res.render("redeem", {
        offlineCashId: record._id,
        ticketCount: record.ticketCount,
        event: {
          id: record.eventId._id,
          name: record.eventId.name,
          startDate: record.eventId.startDate,
          endDate: record.eventId.endDate,
        },
        phone: record.generatedFor,
      });
    }

    // API response
    return responseUtil.success(res, "Link validated", {
      offlineCashId: record._id,
      ticketCount: record.ticketCount,
      event: {
        id: record.eventId._id,
        name: record.eventId.name,
        startDate: record.eventId.startDate,
        endDate: record.eventId.endDate,
      },
      phone: record.generatedFor,
    });
  } catch (error) {
    console.error("Validate redemption link error:", error);
    const acceptHeader = req.get("Accept") || "";
    const isApiRequest =
      req.query.format === "json" ||
      acceptHeader.startsWith("application/json") ||
      req.xhr;
    if (!isApiRequest) {
      return res.status(500).render("error", {
        title: "Error",
        message: "Something went wrong. Please try again later.",
      });
    }
    return responseUtil.internalError(
      res,
      "Failed to validate link",
      error.message
    );
  }
};

/**
 * Redeem tickets (Public - processes form submission)
 */
export const redeemTickets = async (req, res) => {
  try {
    const { offlineCashId, attendees, voucherCode } = req.body;
    // attendees: [{ name: string, phone: string }, ...]

    if (!offlineCashId || !attendees || !Array.isArray(attendees)) {
      return responseUtil.badRequest(
        res,
        "offlineCashId and attendees array are required"
      );
    }

    const record = await OfflineCash.findById(offlineCashId).populate(
      "eventId",
      "name"
    );

    if (!record) {
      return responseUtil.notFound(res, "Offline cash record not found");
    }

    if (record.redeemed) {
      return responseUtil.badRequest(res, "Tickets already redeemed");
    }

    if (attendees.length !== record.ticketCount) {
      return responseUtil.badRequest(
        res,
        `Expected ${record.ticketCount} attendees, got ${attendees.length}`
      );
    }

    // Validate and claim voucher if provided
    let claimedVoucher = null;
    if (voucherCode) {
      const voucher = await Voucher.findOne({
        code: voucherCode.toUpperCase(),
        isActive: true,
      });

      if (!voucher) {
        return responseUtil.badRequest(res, "Invalid voucher code");
      }

      if (!voucher.isAvailable()) {
        return responseUtil.badRequest(res, "This voucher has been exhausted");
      }

      // Check if voucher is event-specific
      if (voucher.events && voucher.events.length > 0) {
        const isValidForEvent = voucher.events.some(
          (e) => e.toString() === record.eventId._id.toString()
        );
        if (!isValidForEvent) {
          return responseUtil.badRequest(
            res,
            "This voucher is not valid for this event"
          );
        }
      }

      // Get all attendee phone numbers
      const attendeePhones = attendees.map((a) => a.phone.slice(-10));

      // Check if any phone has already claimed this voucher
      for (const phone of attendeePhones) {
        if (voucher.hasPhoneClaimed(phone)) {
          return responseUtil.badRequest(
            res,
            `Phone number ${phone} has already claimed this voucher`
          );
        }
      }

      // Atomically claim the voucher for all phones
      claimedVoucher = await Voucher.claimVoucher(voucher._id, attendeePhones);

      if (!claimedVoucher) {
        return responseUtil.badRequest(
          res,
          "Voucher ran out while processing. Please try again."
        );
      }

      console.log(
        `[OFFLINE_CASH] Voucher ${voucherCode} claimed for phones:`,
        attendeePhones
      );
    }

    const createdEnrollments = [];
    const errors = [];

    for (const attendee of attendees) {
      const normalizedPhone = attendee.phone.slice(-10);

      try {
        // Check if user exists, create if not
        let user = await User.findOne({ phone: normalizedPhone });

        if (!user) {
          // Create user with phone as password
          const hashedPassword = await bcrypt.hash(normalizedPhone, 10);
          user = await User.create({
            name: attendee.name,
            phone: normalizedPhone,
            password: hashedPassword,
          });
        }

        // Check if already enrolled for this event
        const existingEnrollment = await CashEventEnrollment.findOne({
          eventId: record.eventId._id,
          phone: normalizedPhone,
        });

        if (existingEnrollment) {
          errors.push({
            phone: normalizedPhone,
            error: "Already enrolled for this event",
          });
          continue;
        }

        // Generate ticket link
        const ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=PLACEHOLDER&userId=${user._id}&eventId=${record.eventId._id}&phone=${normalizedPhone}`;

        // Create enrollment
        const enrollment = await CashEventEnrollment.create({
          eventId: record.eventId._id,
          userId: user._id,
          offlineCashId: record._id,
          phone: normalizedPhone,
          name: attendee.name,
          ticketLink,
        });

        // Update ticket link with actual enrollment ID
        enrollment.ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${record.eventId._id}&phone=${normalizedPhone}`;
        await enrollment.save();

        createdEnrollments.push(enrollment);

        // Generate QR code buffer and upload to Cloudinary
        try {
          console.log(`[OFFLINE_CASH] Generating QR code for ${normalizedPhone}`);

          // Generate QR code as buffer (pointing to cash ticket scan URL)
          const qrBuffer = await QRCode.toBuffer(enrollment.ticketLink, {
            errorCorrectionLevel: "H",
            type: "png",
            width: 400,
            margin: 2,
          });

          console.log(`[OFFLINE_CASH] QR buffer generated (${qrBuffer.length} bytes)`);

          // Upload to Cloudinary
          const qrImageUrl = await uploadQRCodeToCloudinary({
            qrBuffer,
            enrollmentId: enrollment._id.toString(),
            phone: normalizedPhone,
            eventName: record.eventId.name,
          });

          console.log(`[OFFLINE_CASH] QR uploaded to Cloudinary: ${qrImageUrl}`);

          // Send WhatsApp with QR code image URL (non-blocking)
          sendTicketWhatsApp({
            phone: normalizedPhone,
            name: attendee.name,
            eventName: record.eventId.name,
            qrCodeUrl: qrImageUrl,
          }).catch((whatsappErr) =>
            console.error(`[OFFLINE_CASH] WhatsApp error for ${normalizedPhone}:`, whatsappErr.message)
          );
        } catch (qrErr) {
          console.error(`[OFFLINE_CASH] QR/WhatsApp error for ${normalizedPhone}:`, qrErr.message);
          // Don't fail the enrollment if QR/WhatsApp fails
        }
      } catch (err) {
        console.error(`Error processing attendee ${normalizedPhone}:`, err);
        errors.push({ phone: normalizedPhone, error: err.message });
      }
    }

    // Mark as redeemed if at least one enrollment succeeded
    if (createdEnrollments.length > 0) {
      record.redeemed = true;
      record.redeemedAt = new Date();
      await record.save();
    }

    return responseUtil.success(res, "Tickets redeemed", {
      enrollmentsCreated: createdEnrollments.length,
      enrollments: createdEnrollments.map((e) => ({
        id: e._id,
        phone: e.phone,
        name: e.name,
        ticketLink: e.ticketLink,
      })),
      voucher: claimedVoucher
        ? {
            code: claimedVoucher.code,
            title: claimedVoucher.title,
            claimed: true,
          }
        : null,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    console.error("Redeem tickets error:", error);
    return responseUtil.internalError(
      res,
      "Failed to redeem tickets",
      error.message
    );
  }
};

/**
 * Scan cash ticket QR code (Public/Admin)
 */
export const scanCashTicket = async (req, res) => {
  try {
    const { enrollmentId, userId, eventId, phone } = req.query;

    if (!enrollmentId || !eventId || !phone) {
      return responseUtil.badRequest(
        res,
        "enrollmentId, eventId, and phone are required"
      );
    }

    const normalizedPhone = phone.slice(-10);

    const enrollment = await CashEventEnrollment.findOne({
      _id: enrollmentId,
      eventId,
      phone: normalizedPhone,
    })
      .populate("eventId", "name startDate endDate")
      .populate("userId", "name email phone");

    if (!enrollment) {
      return responseUtil.notFound(res, "Enrollment not found");
    }

    if (enrollment.status !== "ACTIVE") {
      return responseUtil.badRequest(
        res,
        `Ticket is ${enrollment.status.toLowerCase()}`
      );
    }

    if (enrollment.isTicketScanned) {
      return responseUtil.success(res, "Ticket already scanned", {
        isValid: true,
        isAlreadyScanned: true,
        scannedAt: enrollment.ticketScannedAt,
        enrollment: {
          id: enrollment._id,
          name: enrollment.name,
          phone: enrollment.phone,
          event: enrollment.eventId,
        },
      });
    }

    // Mark as scanned
    enrollment.isTicketScanned = true;
    enrollment.ticketScannedAt = new Date();
    enrollment.ticketScannedBy = req.user?.id || null;
    await enrollment.save();

    return responseUtil.success(res, "Ticket verified - Entry granted", {
      isValid: true,
      isAlreadyScanned: false,
      scannedAt: enrollment.ticketScannedAt,
      enrollment: {
        id: enrollment._id,
        name: enrollment.name,
        phone: enrollment.phone,
        event: enrollment.eventId,
        user: enrollment.userId,
      },
    });
  } catch (error) {
    console.error("Scan cash ticket error:", error);
    return responseUtil.internalError(
      res,
      "Failed to scan ticket",
      error.message
    );
  }
};

/**
 * Get allowed events for dropdown (based on admin role)
 */
export const getAllowedEvents = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { search, isLive } = req.query;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return responseUtil.unauthorized(res, "Admin not found");
    }

    let query = {};

    // Management staff can only see allowed events
    if (admin.role === "MANAGEMENT_STAFF") {
      if (!admin.allowedEvents || admin.allowedEvents.length === 0) {
        return responseUtil.success(res, "No events assigned", { events: [] });
      }
      query._id = { $in: admin.allowedEvents };
    }
    // ADMIN and SUPER_ADMIN see all events

    if (search) {
      query.name = new RegExp(search, "i");
    }

    if (isLive !== undefined) {
      query.isLive = isLive === "true";
    }

    const events = await Event.find(query)
      .select("_id name startDate isLive category price pricingTiers")
      .sort({ name: 1 })
      .lean();

    return responseUtil.success(res, "Allowed events fetched", { events });
  } catch (error) {
    console.error("Get allowed events error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch events",
      error.message
    );
  }
};

/**
 * Get cash enrollments for an event (Admin)
 */
export const getCashEnrollments = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const adminId = req.user.id;

    const hasAccess = await checkEventAccess(adminId, eventId);
    if (!hasAccess) {
      return responseUtil.forbidden(
        res,
        "You do not have access to this event"
      );
    }

    const filter = { eventId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [enrollments, total] = await Promise.all([
      CashEventEnrollment.find(filter)
        .populate("userId", "name email phone")
        .populate("offlineCashId", "priceCharged signature")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CashEventEnrollment.countDocuments(filter),
    ]);

    return responseUtil.success(res, "Cash enrollments fetched", {
      enrollments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get cash enrollments error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch enrollments",
      error.message
    );
  }
};

export default {
  createOfflineCash,
  getOfflineCashRecords,
  getOfflineCashById,
  deleteOfflineCash,
  validateRedemptionLink,
  redeemTickets,
  scanCashTicket,
  getAllowedEvents,
  getCashEnrollments,
};
