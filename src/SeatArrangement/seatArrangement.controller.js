/**
 * @fileoverview SeatArrangement controller for managing event seating
 * @module controllers/seatArrangement
 */

import mongoose from "mongoose";
import SeatArrangement from "../../schema/SeatArrangement.schema.js";
import Event from "../../schema/Event.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Helper to normalize phone to 10 digits
 */
const normalizePhone = (phone) => {
  if (!phone) return phone;
  const phoneStr = String(phone);
  return phoneStr.length > 10 ? phoneStr.slice(-10) : phoneStr;
};

/**
 * Clean up expired seat reservations for a specific event
 * Called automatically when seats are queried
 * @param {ObjectId} eventId - Event to cleanup
 * @returns {Promise<boolean>} - True if any seats were released
 */
const cleanupExpiredReservations = async (eventId) => {
  try {
    const now = new Date();

    const arrangement = await SeatArrangement.findOne({ eventId });
    if (!arrangement) return false;

    let releasedCount = 0;

    // Find and release expired reservations
    for (const seat of arrangement.seats) {
      if (
        seat.status === "RESERVED" &&
        seat.reservationExpiry &&
        seat.reservationExpiry <= now
      ) {
        seat.status = "AVAILABLE";
        seat.reservedBy = null;
        seat.reservationExpiry = null;
        seat.orderId = null;
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      // Recalculate counts
      arrangement.availableSeatsCount = arrangement.seats.filter(
        (s) => s.status === "AVAILABLE"
      ).length;
      arrangement.reservedSeatsCount = arrangement.seats.filter(
        (s) => s.status === "RESERVED"
      ).length;

      await arrangement.save();
      console.log(
        `[SEAT-ARRANGEMENT] Auto-released ${releasedCount} expired seats for event ${eventId}`
      );
    }

    return releasedCount > 0;
  } catch (error) {
    console.error(
      "[SEAT-ARRANGEMENT] Cleanup error:",
      error.message
    );
    return false;
  }
};

/**
 * Create seat arrangement for an event (Admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createSeatArrangement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId } = req.params;
    const { imageUrl, seats } = req.body;
    const adminId = req.user.id;

    // Verify event exists
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      return responseUtil.notFound(res, "Event not found");
    }

    // Check if arrangement already exists
    const existingArrangement = await SeatArrangement.findOne({
      eventId,
    }).session(session);
    if (existingArrangement) {
      await session.abortTransaction();
      return responseUtil.conflict(
        res,
        "Seat arrangement already exists for this event"
      );
    }

    // Initialize all seats with AVAILABLE status
    const initializedSeats = seats.map((seat) => ({
      label: seat.label.toUpperCase().trim(),
      status: "AVAILABLE",
      bookedBy: null,
      bookedByPhone: null,
      reservedBy: null,
      reservationExpiry: null,
      enrollmentId: null,
      orderId: null,
    }));

    // Create seat arrangement
    const arrangement = new SeatArrangement({
      eventId,
      imageUrl,
      seats: initializedSeats,
      totalSeats: initializedSeats.length,
      availableSeatsCount: initializedSeats.length,
      bookedSeatsCount: 0,
      reservedSeatsCount: 0,
      createdBy: adminId,
    });

    await arrangement.save({ session });

    // Update event
    event.hasSeatArrangement = true;
    event.seatArrangementId = arrangement._id;
    event.availableSeats = arrangement.totalSeats;
    event.updatedBy = adminId;
    await event.save({ session });

    await session.commitTransaction();

    return responseUtil.created(
      res,
      "Seat arrangement created successfully",
      { arrangement }
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Create error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to create seat arrangement",
      error.message
    );
  } finally {
    session.endSession();
  }
};

/**
 * Get seat arrangement for an event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSeatArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const isAdmin = req.user?.userType === "admin";

    // Clean up expired reservations first
    await cleanupExpiredReservations(eventId);

    const arrangement = await SeatArrangement.findOne({ eventId })
      .populate("eventId", "name startDate endDate mode city")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!arrangement) {
      return responseUtil.notFound(res, "Seat arrangement not found");
    }

    // For users, filter out sensitive data
    if (!isAdmin) {
      const filteredSeats = arrangement.seats.map((seat) => ({
        label: seat.label,
        status: seat.status,
        // Don't expose bookedBy/reservedBy user IDs to non-admins
      }));

      return responseUtil.success(res, "Seat arrangement retrieved", {
        arrangement: {
          _id: arrangement._id,
          eventId: arrangement.eventId,
          imageUrl: arrangement.imageUrl,
          totalSeats: arrangement.totalSeats,
          availableSeatsCount: arrangement.availableSeatsCount,
          bookedSeatsCount: arrangement.bookedSeatsCount,
          reservedSeatsCount: arrangement.reservedSeatsCount,
          seats: filteredSeats,
        },
      });
    }

    return responseUtil.success(res, "Seat arrangement retrieved", {
      arrangement,
    });
  } catch (error) {
    console.error("[SEAT-ARRANGEMENT] Get error:", error);
    return responseUtil.internalError(
      res,
      "Failed to retrieve seat arrangement",
      error.message
    );
  }
};

/**
 * Get only available seats for an event (for seat selection UI)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAvailableSeats = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Clean up expired reservations first
    await cleanupExpiredReservations(eventId);

    const arrangement = await SeatArrangement.findOne({ eventId }).select(
      "seats totalSeats availableSeatsCount"
    );

    if (!arrangement) {
      return responseUtil.notFound(res, "Seat arrangement not found");
    }

    // Filter available seats (expired reservations already cleaned up)
    const availableSeats = arrangement.seats
      .filter((seat) => seat.status === "AVAILABLE")
      .map((seat) => seat.label);

    return responseUtil.success(res, "Available seats retrieved", {
      availableSeats,
      totalSeats: arrangement.totalSeats,
      availableCount: availableSeats.length,
    });
  } catch (error) {
    console.error("[SEAT-ARRANGEMENT] Get available seats error:", error);
    return responseUtil.internalError(
      res,
      "Failed to retrieve available seats",
      error.message
    );
  }
};

/**
 * Update seat arrangement (Admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateSeatArrangement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId } = req.params;
    const { imageUrl, seats } = req.body;
    const adminId = req.user.id;

    const arrangement = await SeatArrangement.findOne({ eventId }).session(
      session
    );
    if (!arrangement) {
      await session.abortTransaction();
      return responseUtil.notFound(res, "Seat arrangement not found");
    }

    // Update image URL if provided
    if (imageUrl) {
      arrangement.imageUrl = imageUrl;
    }

    // Update seats if provided
    if (seats && seats.length > 0) {
      const newLabels = seats.map((s) => s.label.toUpperCase().trim());
      const existingSeatsMap = new Map(
        arrangement.seats.map((seat) => [seat.label, seat])
      );

      // Check for seats being removed
      const removedSeats = arrangement.seats.filter(
        (seat) => !newLabels.includes(seat.label)
      );

      // Prevent removal of BOOKED seats
      const bookedSeatsToRemove = removedSeats.filter(
        (seat) => seat.status === "BOOKED"
      );
      if (bookedSeatsToRemove.length > 0) {
        await session.abortTransaction();
        return responseUtil.badRequest(
          res,
          `Cannot remove booked seats: ${bookedSeatsToRemove.map((s) => s.label).join(", ")}`
        );
      }

      // Warn about reserved seats being removed (but allow it)
      const reservedSeatsToRemove = removedSeats.filter(
        (seat) => seat.status === "RESERVED"
      );
      if (reservedSeatsToRemove.length > 0) {
        console.warn(
          `[SEAT-ARRANGEMENT] Removing reserved seats: ${reservedSeatsToRemove.map((s) => s.label).join(", ")}`
        );
      }

      // Build new seats array
      const updatedSeats = newLabels.map((label) => {
        const existingSeat = existingSeatsMap.get(label);
        if (existingSeat) {
          // Keep existing seat with all its data
          return existingSeat;
        } else {
          // New seat - initialize as AVAILABLE
          return {
            label,
            status: "AVAILABLE",
            bookedBy: null,
            bookedByPhone: null,
            reservedBy: null,
            reservationExpiry: null,
            enrollmentId: null,
            orderId: null,
          };
        }
      });

      arrangement.seats = updatedSeats;
    }

    arrangement.updatedBy = adminId;
    await arrangement.save({ session });

    // Sync event availableSeats
    const event = await Event.findById(eventId).session(session);
    if (event) {
      event.availableSeats = arrangement.availableSeatsCount;
      event.updatedBy = adminId;
      await event.save({ session });
    }

    await session.commitTransaction();

    return responseUtil.success(res, "Seat arrangement updated successfully", {
      arrangement,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Update error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to update seat arrangement",
      error.message
    );
  } finally {
    session.endSession();
  }
};

/**
 * Delete seat arrangement (Admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteSeatArrangement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId } = req.params;
    const adminId = req.user.id;

    const arrangement = await SeatArrangement.findOne({ eventId }).session(
      session
    );
    if (!arrangement) {
      await session.abortTransaction();
      return responseUtil.notFound(res, "Seat arrangement not found");
    }

    // Check if any seats are BOOKED
    const bookedSeats = arrangement.seats.filter(
      (seat) => seat.status === "BOOKED"
    );
    if (bookedSeats.length > 0) {
      await session.abortTransaction();
      return responseUtil.badRequest(
        res,
        `Cannot delete arrangement with ${bookedSeats.length} booked seat(s)`
      );
    }

    // Warn about reserved seats (but allow deletion)
    const reservedSeats = arrangement.seats.filter(
      (seat) => seat.status === "RESERVED"
    );
    if (reservedSeats.length > 0) {
      console.warn(
        `[SEAT-ARRANGEMENT] Deleting arrangement with ${reservedSeats.length} reserved seats`
      );
    }

    // Delete arrangement
    await SeatArrangement.deleteOne({ _id: arrangement._id }).session(session);

    // Update event
    const event = await Event.findById(eventId).session(session);
    if (event) {
      event.hasSeatArrangement = false;
      event.seatArrangementId = null;
      event.updatedBy = adminId;
      await event.save({ session });
    }

    await session.commitTransaction();

    return responseUtil.success(res, "Seat arrangement deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Delete error:", error);
    return responseUtil.internalError(
      res,
      "Failed to delete seat arrangement",
      error.message
    );
  } finally {
    session.endSession();
  }
};

/**
 * Reserve seats temporarily (15 minutes) - Internal helper
 * Called from payment.controller.js
 * @param {Object} params - { eventId, selectedSeats, userId, orderId }
 */
export const reserveSeats = async ({ eventId, selectedSeats, userId, orderId }) => {
  // Clean up expired reservations first to make them available
  await cleanupExpiredReservations(eventId);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const arrangement = await SeatArrangement.findOne({ eventId }).session(
      session
    );
    if (!arrangement) {
      await session.abortTransaction();
      throw new Error("Seat arrangement not found");
    }

    const now = new Date();
    const reservationExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const requestedLabels = selectedSeats.map((s) => s.seatLabel.toUpperCase().trim());
    const unavailableSeats = [];

    // Check all requested seats are available (expired reservations already cleaned)
    for (const seatLabel of requestedLabels) {
      const seat = arrangement.seats.find((s) => s.label === seatLabel);

      if (!seat) {
        unavailableSeats.push(`${seatLabel} (not found)`);
        continue;
      }

      // Seat must be AVAILABLE
      if (seat.status !== "AVAILABLE") {
        unavailableSeats.push(`${seatLabel} (${seat.status})`);
      }
    }

    if (unavailableSeats.length > 0) {
      await session.abortTransaction();
      throw new Error(
        `Selected seats are no longer available: ${unavailableSeats.join(", ")}`
      );
    }

    // Reserve all requested seats
    for (const { seatLabel, phone } of selectedSeats) {
      const seat = arrangement.seats.find(
        (s) => s.label === seatLabel.toUpperCase().trim()
      );
      if (seat) {
        seat.status = "RESERVED";
        seat.reservedBy = userId;
        seat.reservationExpiry = reservationExpiry;
        seat.orderId = orderId;
        seat.bookedByPhone = normalizePhone(phone); // Store for later
      }
    }

    await arrangement.save({ session });
    await session.commitTransaction();

    console.log(
      `[SEAT-ARRANGEMENT] Reserved ${requestedLabels.length} seats for order ${orderId}`
    );
    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Reserve seats error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Confirm seat booking (convert RESERVED → BOOKED) - Internal helper
 * Called from razorpay.webhook.js after payment success
 * @param {Object} params - { orderId, enrollmentId }
 */
export const confirmSeatBooking = async ({ orderId, enrollmentId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const arrangement = await SeatArrangement.findOne({
      "seats.orderId": orderId,
    }).session(session);

    if (!arrangement) {
      await session.abortTransaction();
      throw new Error(`No seat reservations found for order ${orderId}`);
    }

    const enrollment = await EventEnrollment.findById(enrollmentId).session(
      session
    );
    if (!enrollment) {
      await session.abortTransaction();
      throw new Error("Enrollment not found");
    }

    // Convert all RESERVED seats with this orderId to BOOKED
    for (const seat of arrangement.seats) {
      if (seat.status === "RESERVED" && seat.orderId === orderId) {
        seat.status = "BOOKED";
        seat.bookedBy = enrollment.userId;
        seat.enrollmentId = enrollmentId;
        // Keep bookedByPhone (already set during reservation)
        // Clear temporary reservation fields
        seat.reservedBy = null;
        seat.reservationExpiry = null;
        seat.orderId = null;
      }
    }

    await arrangement.save({ session });
    await session.commitTransaction();

    console.log(
      `[SEAT-ARRANGEMENT] Confirmed booking for order ${orderId}, enrollment ${enrollmentId}`
    );
    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Confirm booking error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Release seat reservation (convert RESERVED → AVAILABLE) - Internal helper
 * Called from payment failure handlers
 * @param {Object} params - { orderId }
 */
export const releaseSeatReservation = async ({ orderId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const arrangement = await SeatArrangement.findOne({
      "seats.orderId": orderId,
    }).session(session);

    if (!arrangement) {
      // No seats to release - this is OK
      await session.commitTransaction();
      return null;
    }

    let releasedCount = 0;

    // Release all RESERVED seats with this orderId
    for (const seat of arrangement.seats) {
      if (seat.status === "RESERVED" && seat.orderId === orderId) {
        seat.status = "AVAILABLE";
        seat.reservedBy = null;
        seat.reservationExpiry = null;
        seat.orderId = null;
        seat.bookedByPhone = null;
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      await arrangement.save({ session });
      console.log(
        `[SEAT-ARRANGEMENT] Released ${releasedCount} reserved seats for order ${orderId}`
      );
    }

    await session.commitTransaction();
    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error(
      "[SEAT-ARRANGEMENT] Release reservation error:",
      error.message
    );
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Cancel seat booking (convert BOOKED → AVAILABLE) - Internal helper
 * Called from ticket cancellation
 * @param {Object} params - { enrollmentId, phone }
 */
export const cancelSeatBooking = async ({ enrollmentId, phone }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const normalizedPhone = normalizePhone(phone);

    const arrangement = await SeatArrangement.findOne({
      "seats.enrollmentId": enrollmentId,
      "seats.bookedByPhone": normalizedPhone,
    }).session(session);

    if (!arrangement) {
      // No seat found - this is OK (event might not have seat arrangement)
      await session.commitTransaction();
      return null;
    }

    // Find and release the specific seat
    const seat = arrangement.seats.find(
      (s) =>
        s.enrollmentId &&
        s.enrollmentId.toString() === enrollmentId.toString() &&
        s.bookedByPhone === normalizedPhone
    );

    if (seat) {
      seat.status = "AVAILABLE";
      seat.bookedBy = null;
      seat.bookedByPhone = null;
      seat.enrollmentId = null;

      await arrangement.save({ session });
      console.log(
        `[SEAT-ARRANGEMENT] Released seat ${seat.label} for enrollment ${enrollmentId}, phone ${normalizedPhone}`
      );
    }

    await session.commitTransaction();
    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error("[SEAT-ARRANGEMENT] Cancel seat booking error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  createSeatArrangement,
  getSeatArrangement,
  getAvailableSeats,
  updateSeatArrangement,
  deleteSeatArrangement,
  reserveSeats,
  confirmSeatBooking,
  releaseSeatReservation,
  cancelSeatBooking,
};
