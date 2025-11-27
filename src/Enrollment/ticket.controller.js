/**
 * @fileoverview QR Ticket controller for event enrollment verification
 * @module controllers/ticket
 */

import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import Event from "../../schema/Event.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";
import fs from "fs";
import path from "path";

/**
 * Generate JWT tokens for all tickets in enrollment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with tokens for all tickets
 */
export const generateTicketToken = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    // Find enrollment and verify it belongs to the user
    const enrollment = await EventEnrollment.findOne({
      _id: enrollmentId,
      userId,
    }).populate("eventId", "name startDate endDate");

    if (!enrollment) {
      return responseUtil.notFound(res, "Enrollment not found");
    }

    // Generate tokens for each ticket
    const ticketTokens = [];

    for (const [phone, ticket] of enrollment.tickets) {
      // Create JWT token with enrollment and phone data
      const tokenPayload = {
        enrollmentId: enrollment._id.toString(),
        userId: enrollment.userId.toString(),
        eventId: enrollment.eventId._id.toString(),
        phone,
        timestamp: Date.now(),
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: "30d", // Token valid for 30 days
      });

      // Create verification URL
      const verificationUrl = `${req.protocol}://${req.get(
        "host"
      )}/api/web/tickets/verify?token=${token}`;

      ticketTokens.push({
        phone,
        token,
        verificationUrl,
        ticketStatus: ticket.status,
        isScanned: ticket.isTicketScanned,
      });
    }

    return responseUtil.success(res, "Ticket tokens generated successfully", {
      enrollmentId: enrollment._id,
      eventName: enrollment.eventId.name,
      eventStartDate: enrollment.eventId.startDate,
      ticketCount: enrollment.ticketCount,
      tickets: ticketTokens,
    });
  } catch (error) {
    console.error("Generate ticket token error:", error);
    return responseUtil.internalError(
      res,
      "Failed to generate ticket token",
      error.message
    );
  }
};

/**
 * Generate QR code PNG for a specific ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {File} QR code PNG file
 */
export const generateQRCode = async (req, res) => {
  try {
    const { enrollmentId, phone } = req.params;
    const userId = req.user.id;

    // Find enrollment and verify it belongs to the user
    const enrollment = await EventEnrollment.findOne({
      _id: enrollmentId,
      userId,
    }).populate("eventId", "name");

    if (!enrollment) {
      return responseUtil.notFound(res, "Enrollment not found");
    }

    // Check if ticket exists for this phone
    const ticket = enrollment.tickets.get(phone);

    if (!ticket) {
      return responseUtil.notFound(res, `Ticket for phone ${phone} not found`);
    }

    // Create JWT token with phone
    const tokenPayload = {
      enrollmentId: enrollment._id.toString(),
      userId: enrollment.userId.toString(),
      eventId: enrollment.eventId._id.toString(),
      phone,
      timestamp: Date.now(),
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Create verification URL
    const verificationUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/web/tickets/verify?token=${token}`;

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      errorCorrectionLevel: "H",
      type: "png",
      width: 500,
      margin: 2,
    });

    // Set headers for file download
    const filename = `ticket-${enrollment.eventId.name.replace(
      /\s+/g,
      "-"
    )}-${phone}.png`;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", qrBuffer.length);

    // Send buffer
    return res.send(qrBuffer);
  } catch (error) {
    console.error("Generate QR code error:", error);
    return responseUtil.internalError(
      res,
      "Failed to generate QR code",
      error.message
    );
  }
};

/**
 * Verify ticket QR code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with verification status
 */
export const verifyTicket = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return responseUtil.badRequest(res, "Token is required");
    }

    // Verify and decode JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return responseUtil.unauthorized(
          res,
          "Ticket has expired",
          "TOKEN_EXPIRED"
        );
      }
      if (error.name === "JsonWebTokenError") {
        return responseUtil.unauthorized(
          res,
          "Invalid ticket - Token is not legitimate",
          "INVALID_TOKEN"
        );
      }
      throw error;
    }

    const { enrollmentId, userId, eventId, phone } = decoded;

    if (!phone) {
      return responseUtil.badRequest(
        res,
        "Invalid ticket - phone number missing from token"
      );
    }

    // Find enrollment
    const enrollment = await EventEnrollment.findOne({
      _id: enrollmentId,
      userId,
      eventId,
    })
      .populate("eventId", "name startDate endDate location")
      .populate("userId", "name email phone");

    if (!enrollment) {
      return responseUtil.notFound(
        res,
        "Ticket not found or enrollment not found",
        "ENROLLMENT_NOT_FOUND"
      );
    }

    // Get the specific ticket for this phone
    const ticket = enrollment.tickets.get(phone);

    if (!ticket) {
      return responseUtil.notFound(
        res,
        `Ticket for phone ${phone} not found`,
        "TICKET_NOT_FOUND"
      );
    }

    if (ticket.status !== "ACTIVE") {
      return responseUtil.badRequest(
        res,
        `Ticket is ${ticket.status.toLowerCase()}`,
        "TICKET_NOT_ACTIVE"
      );
    }

    // Check if ticket was already scanned
    if (ticket.isTicketScanned) {
      return responseUtil.success(res, "Ticket is valid but already scanned", {
        isValid: true,
        isAlreadyScanned: true,
        scannedAt: ticket.ticketScannedAt,
        ticket: {
          phone,
          status: ticket.status,
        },
        enrollment: {
          id: enrollment._id,
          user: {
            name: enrollment.userId.name,
            email: enrollment.userId.email,
            phone: enrollment.userId.phone,
          },
          event: {
            name: enrollment.eventId.name,
            startDate: enrollment.eventId.startDate,
            endDate: enrollment.eventId.endDate,
            location: enrollment.eventId.location,
          },
        },
      });
    }

    // Mark this specific ticket as scanned
    ticket.isTicketScanned = true;
    ticket.ticketScannedAt = new Date();
    ticket.ticketScannedBy = req.user?.id || null; // If admin middleware adds admin/user info
    enrollment.tickets.set(phone, ticket);
    await enrollment.save();

    return responseUtil.success(
      res,
      "Ticket verified successfully - Entry granted",
      {
        isValid: true,
        isAlreadyScanned: false,
        scannedAt: ticket.ticketScannedAt,
        ticket: {
          phone,
          status: ticket.status,
        },
        enrollment: {
          id: enrollment._id,
          user: {
            name: enrollment.userId.name,
            email: enrollment.userId.email,
            phone: enrollment.userId.phone,
          },
          event: {
            name: enrollment.eventId.name,
            startDate: enrollment.eventId.startDate,
            endDate: enrollment.eventId.endDate,
            location: enrollment.eventId.location,
          },
        },
      }
    );
  } catch (error) {
    console.error("Verify ticket error:", error);
    return responseUtil.internalError(
      res,
      "Failed to verify ticket",
      error.message
    );
  }
};

/**
 * Generate mock QR scan links for testing (one for each ticket)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with QR scan links
 */
export const generateMockQRLink = async (req, res) => {
  try {
    const { enrollmentId } = req.query;

    if (!enrollmentId) {
      return responseUtil.badRequest(res, "enrollmentId is required");
    }

    // Find enrollment to get userId and eventId
    const enrollment = await EventEnrollment.findById(enrollmentId);

    if (!enrollment) {
      return responseUtil.notFound(res, "Enrollment not found");
    }

    // Generate QR scan links for each ticket (phone number)
    const qrScanLinks = [];
    for (const [phone, ticket] of enrollment.tickets) {
      const qrScanLink = `https://motivata.synquic.com/api/app/tickets/qr-scan?enrollmentId=${enrollmentId}&userId=${enrollment.userId}&eventId=${enrollment.eventId}&phone=${phone}`;
      qrScanLinks.push({
        phone,
        qrScanLink,
        ticketStatus: ticket.status,
      });
    }

    return responseUtil.success(
      res,
      "Mock QR scan links generated successfully",
      {
        enrollmentId,
        userId: enrollment.userId,
        eventId: enrollment.eventId,
        ticketCount: enrollment.ticketCount,
        qrScanLinks,
      }
    );
  } catch (error) {
    console.error("Generate mock QR link error:", error);
    return responseUtil.internalError(
      res,
      "Failed to generate mock QR link",
      error.message
    );
  }
};

/**
 * Scan QR code and fetch enrollment details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with user, event, and enrollment details
 */
export const scanQRCode = async (req, res) => {
  try {
    const { enrollmentId, userId, eventId, phone } = req.query;

    if (!enrollmentId || !eventId || !phone) {
      return responseUtil.badRequest(
        res,
        "enrollmentId, eventId, and phone are required"
      );
    }

    // Fetch enrollment details
    // Note: We don't filter by userId because the enrollment belongs to the buyer,
    // but other ticket holders (in multi-ticket purchases) have different userIds
    const enrollment = await EventEnrollment.findOne({
      _id: enrollmentId,
      eventId,
    });

    if (!enrollment) {
      return responseUtil.notFound(res, "Enrollment not found");
    }

    // Check if ticket exists for this phone number
    const ticket = enrollment.tickets.get(phone);

    if (!ticket) {
      return responseUtil.notFound(
        res,
        `Ticket for phone number ${phone} not found in this enrollment`
      );
    }

    // Check ticket status
    if (ticket.status !== "ACTIVE") {
      return responseUtil.badRequest(
        res,
        `Ticket for phone ${phone} is ${ticket.status.toLowerCase()}`
      );
    }

    // Check if already scanned
    if (ticket.isTicketScanned) {
      return responseUtil.badRequest(
        res,
        `Ticket for phone ${phone} has already been scanned at ${ticket.ticketScannedAt}`
      );
    }

    // Fetch user details
    // userId from query is the ticket holder's userId (could be buyer or other member)
    let user = null;
    if (userId) {
      user = await User.findById(userId).select("name email phone");
    }

    // If user not found by userId or userId not provided, try to find by phone
    if (!user) {
      user = await User.findOne({ phone, isDeleted: false }).select("name email phone");
    }

    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // Fetch event details
    const event = await Event.findById(eventId).select(
      "name description imageUrls thumbnail mode city category startDate endDate price compareAtPrice availableSeats isLive"
    );

    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Update ticket scan status for this specific phone
    ticket.isTicketScanned = true;
    ticket.ticketScannedAt = new Date();
    enrollment.tickets.set(phone, ticket);
    await enrollment.save();

    return responseUtil.success(res, "QR code scanned successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      event: {
        id: event._id,
        name: event.name,
        description: event.description,
        imageUrls: event.imageUrls,
        thumbnail: event.thumbnail,
        mode: event.mode,
        city: event.city,
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
        price: event.price,
        compareAtPrice: event.compareAtPrice,
        availableSeats: event.availableSeats,
        isLive: event.isLive,
      },
      ticket: {
        phone,
        status: ticket.status,
        isTicketScanned: ticket.isTicketScanned,
        ticketScannedAt: ticket.ticketScannedAt,
      },
      enrollment: {
        id: enrollment._id,
        paymentId: enrollment.paymentId,
        orderId: enrollment.orderId,
        ticketCount: enrollment.ticketCount,
        createdAt: enrollment.createdAt,
      },
    });
  } catch (error) {
    console.error("Scan QR code error:", error);
    return responseUtil.internalError(
      res,
      "Failed to scan QR code",
      error.message
    );
  }
};
