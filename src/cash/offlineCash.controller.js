/**
 * @fileoverview Offline Cash controller for cash payment ticket management
 * @module controllers/offlineCash
 */

import OfflineCash from "../../schema/OfflineCash.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import Voucher from "../../schema/Voucher.Schema.js";
import responseUtil from "../../utils/response.util.js";
import { sendTicketWhatsApp, sendRedemptionLinkWhatsApp, sendBulkVoucherWhatsApp } from "../../utils/whatsapp.util.js";
import { uploadQRCodeToCloudinary, generateVoucherQRCode, uploadVoucherQRCodeToCloudinary } from "../../utils/qrcode.util.js";
import { generateTicketImage, uploadTicketImageToCloudinary } from "../../utils/ticketImage.util.js";
import bcrypt from "bcrypt";

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

    // Check admin's max cash tickets limit (for MANAGEMENT_STAFF)
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return responseUtil.unauthorized(res, "Admin not found");
    }

    if (admin.maxCashTicketsAllowed != null) {
      // Count total tickets already created by this admin
      const totalTicketsCreated = await OfflineCash.aggregate([
        {
          $match: {
            generatedBy: admin._id,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalTickets: { $sum: "$ticketCount" },
          },
        },
      ]);

      const currentTotal = totalTicketsCreated.length > 0 ? totalTicketsCreated[0].totalTickets : 0;
      const newTotal = currentTotal + ticketCount;

      if (newTotal > admin.maxCashTicketsAllowed) {
        return responseUtil.badRequest(
          res,
          `Cannot create ${ticketCount} ticket(s). Your maximum cash tickets allowed: ${admin.maxCashTicketsAllowed}, Already created: ${currentTotal}, Available: ${admin.maxCashTicketsAllowed - currentTotal}`
        );
      }
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

    // Check if phone already has a redeemed cash ticket for this event
    const redeemedOfflineCash = await OfflineCash.findOne({
      eventId,
      generatedFor: normalizedPhone,
      redeemed: true,
    });
    if (redeemedOfflineCash) {
      return responseUtil.conflict(
        res,
        "This phone already has a redeemed cash ticket for this event"
      );
    }

    // Check if phone already has a CashEventEnrollment for this event
    const existingCashEnrollment = await CashEventEnrollment.findOne({
      eventId,
      phone: normalizedPhone,
    });
    if (existingCashEnrollment) {
      return responseUtil.conflict(
        res,
        "This phone already has a cash ticket for this event"
      );
    }

    // Check if phone exists in EventEnrollment tickets Map (online ticket)
    const enrollmentWithPhone = await EventEnrollment.findOne({
      eventId,
      [`tickets.${normalizedPhone}`]: { $exists: true },
    });
    if (enrollmentWithPhone) {
      return responseUtil.conflict(
        res,
        "This phone already has an online ticket for this event"
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
        eventId: eventId,
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
        .populate("eventId", "name startDate endDate bookingStartDate bookingEndDate")
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
      .populate("eventId", "name startDate endDate bookingStartDate bookingEndDate")
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
    }).populate("eventId", "name startDate endDate bookingStartDate bookingEndDate");

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
 * IMPORTANT: All enrollments must succeed for redemption to complete.
 * Pre-validates all attendees before creating any enrollments.
 */
export const redeemTickets = async (req, res) => {
  try {
    const { offlineCashId, attendees, code } = req.body;
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

    // ========== PRE-VALIDATION PHASE ==========
    // Validate ALL attendees before creating any enrollments
    console.log(`[OFFLINE_CASH] Pre-validating ${attendees.length} attendees for offlineCashId=${offlineCashId}`);

    const validationErrors = [];
    const normalizedPhones = [];
    const phoneToAttendee = new Map();

    // Step 1: Normalize phones and check for duplicates in the request
    for (let i = 0; i < attendees.length; i++) {
      const attendee = attendees[i];

      if (!attendee.phone || !attendee.name) {
        validationErrors.push({
          index: i,
          phone: attendee.phone || 'missing',
          error: "Name and phone are required for each attendee"
        });
        continue;
      }

      const normalizedPhone = attendee.phone.slice(-10);

      // Validate phone format (10 digits)
      if (!/^\d{10}$/.test(normalizedPhone)) {
        validationErrors.push({
          index: i,
          phone: attendee.phone,
          error: "Invalid phone number format (must be 10 digits)"
        });
        continue;
      }

      // Check for duplicate phones in the request
      if (phoneToAttendee.has(normalizedPhone)) {
        const existingIndex = phoneToAttendee.get(normalizedPhone).index;
        validationErrors.push({
          index: i,
          phone: normalizedPhone,
          error: `Duplicate phone number (same as attendee #${existingIndex + 1})`
        });
        continue;
      }

      normalizedPhones.push(normalizedPhone);
      phoneToAttendee.set(normalizedPhone, { ...attendee, index: i, normalizedPhone });
    }

    // Step 2: Check for existing enrollments in database (batch query)
    if (normalizedPhones.length > 0) {
      const existingEnrollments = await CashEventEnrollment.find({
        eventId: record.eventId._id,
        phone: { $in: normalizedPhones }
      }).select('phone');

      const existingPhones = new Set(existingEnrollments.map(e => e.phone));

      for (const phone of existingPhones) {
        const attendee = phoneToAttendee.get(phone);
        validationErrors.push({
          index: attendee.index,
          phone: phone,
          error: "Already enrolled for this event"
        });
        // Remove from valid list
        phoneToAttendee.delete(phone);
      }
    }

    // Step 3: Return early if any validation errors
    if (validationErrors.length > 0) {
      console.log(`[OFFLINE_CASH] Pre-validation failed: ${validationErrors.length} error(s)`);
      return responseUtil.badRequest(
        res,
        `Cannot redeem tickets: ${validationErrors.length} attendee(s) have validation errors`,
        {
          errors: validationErrors.map(e => ({
            attendee: e.index + 1,
            phone: e.phone,
            reason: e.error
          }))
        }
      );
    }

    console.log(`[OFFLINE_CASH] Pre-validation passed for ${phoneToAttendee.size} attendees`);

    // ========== VOUCHER HANDLING ==========
    let claimedVoucher = null;
    let voucherClaimedPhones = [];
    if (code) {
      const voucher = await Voucher.findOne({
        code: code.toUpperCase(),
        isActive: true,
      });

      if (!voucher) {
        return responseUtil.badRequest(res, "Invalid voucher code");
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
      const attendeePhones = Array.from(phoneToAttendee.keys());

      // Filter out phones that have already claimed this voucher
      const eligiblePhones = attendeePhones.filter(phone => !voucher.hasPhoneClaimed(phone));

      if (eligiblePhones.length === 0) {
        console.log('[OFFLINE_CASH] All phones have already claimed this voucher');
      } else {
        const availableSlots = voucher.maxUsage - voucher.claimedPhones.length;

        if (availableSlots <= 0) {
          console.log('[OFFLINE_CASH] No voucher slots available');
        } else {
          const phonesToClaim = eligiblePhones.slice(0, availableSlots);
          const phonesLeftOut = eligiblePhones.slice(availableSlots);

          if (phonesLeftOut.length > 0) {
            console.log(`[OFFLINE_CASH] Partial voucher claim: ${phonesToClaim.length} of ${eligiblePhones.length}`);
          }

          claimedVoucher = await Voucher.claimVoucher(voucher._id, phonesToClaim);

          if (!claimedVoucher) {
            console.log('[OFFLINE_CASH] Voucher claim race condition');
          } else {
            voucherClaimedPhones = phonesToClaim;
            console.log(`[OFFLINE_CASH] Voucher ${code} claimed for ${phonesToClaim.length} phone(s)`);

            try {
              const confirmedVoucher = await Voucher.confirmVoucherClaim(voucher._id, phonesToClaim.length);
              if (confirmedVoucher) {
                console.log(`[OFFLINE_CASH] Voucher claim confirmed: usageCount=${confirmedVoucher.usageCount}`);
                claimedVoucher = confirmedVoucher;
              } else {
                console.warn(`[OFFLINE_CASH] Voucher confirm failed: ${voucher._id}`);
              }
            } catch (confirmError) {
              console.error(`[OFFLINE_CASH] Voucher confirm error: ${confirmError.message}`);
            }
          }
        }
      }
    }

    // ========== ENROLLMENT CREATION PHASE ==========
    // All validations passed - create enrollments
    const createdEnrollments = [];
    const enrollmentErrors = [];

    for (const [normalizedPhone, attendeeData] of phoneToAttendee) {
      try {
        // Find or create user
        let user = await User.findOne({ phone: normalizedPhone });

        if (!user) {
          const hashedPassword = await bcrypt.hash(normalizedPhone, 10);
          user = await User.create({
            name: attendeeData.name,
            phone: normalizedPhone,
            password: hashedPassword,
          });
          console.log(`[OFFLINE_CASH] Created user: ${normalizedPhone}`);
        }

        // Generate ticket link
        const ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=PLACEHOLDER&userId=${user._id}&eventId=${record.eventId._id}&phone=${normalizedPhone}`;

        // Create enrollment
        const enrollment = await CashEventEnrollment.create({
          eventId: record.eventId._id,
          userId: user._id,
          offlineCashId: record._id,
          phone: normalizedPhone,
          name: attendeeData.name,
          ticketLink,
        });

        // Update ticket link with actual enrollment ID
        enrollment.ticketLink = `${BASE_URL}/app/tickets/cash/qr-scan?enrollmentId=${enrollment._id}&userId=${user._id}&eventId=${record.eventId._id}&phone=${normalizedPhone}`;
        await enrollment.save();

        createdEnrollments.push({ enrollment, user, attendeeData });
        console.log(`[OFFLINE_CASH] Enrollment created: ${normalizedPhone}`);

      } catch (err) {
        console.error(`[OFFLINE_CASH] Enrollment error for ${normalizedPhone}: ${err.message}`);
        enrollmentErrors.push({ phone: normalizedPhone, error: err.message });
      }
    }

    // ========== ROLLBACK IF PARTIAL FAILURE ==========
    // If not ALL enrollments were created, rollback and fail
    if (enrollmentErrors.length > 0) {
      console.log(`[OFFLINE_CASH] Partial failure: ${enrollmentErrors.length} error(s), rolling back ${createdEnrollments.length} enrollment(s)`);

      // Delete the enrollments that were created
      for (const { enrollment } of createdEnrollments) {
        try {
          await CashEventEnrollment.findByIdAndDelete(enrollment._id);
          console.log(`[OFFLINE_CASH] Rolled back enrollment: ${enrollment.phone}`);
        } catch (rollbackErr) {
          console.error(`[OFFLINE_CASH] Rollback error for ${enrollment.phone}: ${rollbackErr.message}`);
        }
      }

      // Rollback voucher claim if any
      if (claimedVoucher && voucherClaimedPhones.length > 0) {
        try {
          // Remove claimed phones from voucher
          await Voucher.findByIdAndUpdate(claimedVoucher._id, {
            $pull: { claimedPhones: { $in: voucherClaimedPhones } },
            $inc: { usageCount: -voucherClaimedPhones.length }
          });
          console.log(`[OFFLINE_CASH] Rolled back voucher claim for ${voucherClaimedPhones.length} phone(s)`);
        } catch (voucherRollbackErr) {
          console.error(`[OFFLINE_CASH] Voucher rollback error: ${voucherRollbackErr.message}`);
        }
      }

      return responseUtil.internalError(
        res,
        `Failed to create all enrollments. ${enrollmentErrors.length} failed, ${createdEnrollments.length} rolled back.`,
        {
          errors: enrollmentErrors.map(e => ({
            phone: e.phone,
            reason: e.error
          }))
        }
      );
    }

    // ========== ALL ENROLLMENTS SUCCEEDED - MARK AS REDEEMED ==========
    record.redeemed = true;
    record.redeemedAt = new Date();
    await record.save();
    console.log(`[OFFLINE_CASH] Redemption complete: offlineCashId=${offlineCashId}, enrollments=${createdEnrollments.length}`);

    // ========== POST-REDEMPTION: SEND TICKETS (NON-BLOCKING) ==========
    // Send ticket images and WhatsApp messages asynchronously
    const sendTicketsAsync = async () => {
      const eventDetails = await Event.findById(record.eventId._id);

      for (const { enrollment, user, attendeeData } of createdEnrollments) {
        try {
          let imageUrl;
          try {
            const ticketBuffer = await generateTicketImage({
              qrData: enrollment.ticketLink,
              eventName: record.eventId.name,
              eventMode: eventDetails?.mode || 'OFFLINE',
              eventLocation: eventDetails?.location || eventDetails?.city || '',
              eventStartDate: eventDetails?.startDate,
              eventEndDate: eventDetails?.endDate,
              ticketCount: 1,
              ticketPrice: record.priceCharged || eventDetails?.price || '',
              venueName: eventDetails?.venue || eventDetails?.location || '',
              bookingId: enrollment._id.toString()
            });

            imageUrl = await uploadTicketImageToCloudinary({
              imageBuffer: ticketBuffer,
              enrollmentId: enrollment._id.toString(),
              phone: enrollment.phone,
              eventName: record.eventId.name,
            });
          } catch (ticketImageErr) {
            console.log(`[OFFLINE_CASH] Ticket image failed for ${enrollment.phone}, using QR fallback`);

            const QRCode = (await import('qrcode')).default;
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
              eventName: record.eventId.name,
            });
          }

          // Send WhatsApp
          await sendTicketWhatsApp({
            phone: enrollment.phone,
            name: attendeeData.name,
            eventName: record.eventId.name,
            qrCodeUrl: imageUrl,
            eventId: record.eventId._id.toString(),
            userId: user._id.toString(),
            enrollmentId: enrollment._id.toString(),
          });
        } catch (ticketErr) {
          console.error(`[OFFLINE_CASH] Ticket/WhatsApp error for ${enrollment.phone}: ${ticketErr.message}`);
        }
      }
    };

    // Fire and forget - don't block the response
    sendTicketsAsync().catch(err => {
      console.error(`[OFFLINE_CASH] Async ticket sending error: ${err.message}`);
    });

    // Send voucher QR codes if voucher was claimed (non-blocking)
    if (claimedVoucher && voucherClaimedPhones.length > 0) {
      const sendVoucherQRsAsync = async () => {
        console.log(`[OFFLINE_CASH] Sending voucher QRs: code=${claimedVoucher.code}, phones=${voucherClaimedPhones.length}`);

        const voucherWhatsappMessages = [];

        for (const { enrollment, attendeeData } of createdEnrollments) {
          try {
            const normalizedPhone = enrollment.phone;

            if (!voucherClaimedPhones.includes(normalizedPhone)) {
              continue;
            }

            const qrBuffer = await generateVoucherQRCode({
              phone: normalizedPhone,
              voucherCode: claimedVoucher.code
            });

            const qrUrl = await uploadVoucherQRCodeToCloudinary({
              qrBuffer,
              voucherCode: claimedVoucher.code,
              phone: normalizedPhone
            });

            voucherWhatsappMessages.push({
              phone: normalizedPhone,
              name: attendeeData.name,
              voucherTitle: claimedVoucher.title,
              qrCodeUrl: qrUrl
            });
          } catch (voucherQrErr) {
            console.error(`[OFFLINE_CASH] Voucher QR error for ${enrollment.phone}: ${voucherQrErr.message}`);
          }
        }

        if (voucherWhatsappMessages.length > 0) {
          try {
            await sendBulkVoucherWhatsApp(voucherWhatsappMessages);
            console.log(`[OFFLINE_CASH] Voucher WhatsApp sent: ${voucherWhatsappMessages.length} message(s)`);
          } catch (whatsappErr) {
            console.error(`[OFFLINE_CASH] Voucher WhatsApp error: ${whatsappErr.message}`);
          }
        }
      };

      // Fire and forget
      sendVoucherQRsAsync().catch(err => {
        console.error(`[OFFLINE_CASH] Async voucher QR error: ${err.message}`);
      });
    }

    return responseUtil.success(res, "Tickets redeemed successfully", {
      enrollmentsCreated: createdEnrollments.length,
      enrollments: createdEnrollments.map(({ enrollment }) => ({
        id: enrollment._id,
        phone: enrollment.phone,
        name: enrollment.name,
        ticketLink: enrollment.ticketLink,
      })),
      voucher: claimedVoucher
        ? {
            code: claimedVoucher.code,
            title: claimedVoucher.title,
            claimed: true,
            claimedPhones: voucherClaimedPhones,
          }
        : null,
    });
  } catch (error) {
    console.error(`[OFFLINE_CASH] Redeem tickets error: ${error.message}`);
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
      .populate("eventId", "name startDate endDate bookingStartDate bookingEndDate")
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
      // Fetch voucher for already scanned ticket
      const claimedVoucher = await Voucher.findOne({
        claimedPhones: normalizedPhone,
        isActive: true,
        $or: [
          { events: { $size: 0 } },
          { events: { $exists: false } },
          { events: eventId }
        ]
      }).select('_id code title description');

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
        voucher: claimedVoucher ? {
          id: claimedVoucher._id,
          code: claimedVoucher.code,
          title: claimedVoucher.title,
          description: claimedVoucher.description,
        } : null,
      });
    }

    // Mark as scanned
    enrollment.isTicketScanned = true;
    enrollment.ticketScannedAt = new Date();
    enrollment.ticketScannedBy = req.user?.id || null;
    await enrollment.save();

    // Fetch voucher claimed by this phone for this event
    const claimedVoucher = await Voucher.findOne({
      claimedPhones: normalizedPhone,
      isActive: true,
      $or: [
        { events: { $size: 0 } },
        { events: { $exists: false } },
        { events: eventId }
      ]
    }).select('_id code title description');

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
      voucher: claimedVoucher ? {
        id: claimedVoucher._id,
        code: claimedVoucher.code,
        title: claimedVoucher.title,
        description: claimedVoucher.description,
      } : null,
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
