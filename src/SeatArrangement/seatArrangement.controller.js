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
 * @returns {Promise<number>} - Number of seats released
 */
const cleanupExpiredReservations = async (eventId) => {
  try {
    const now = new Date();

    const arrangement = await SeatArrangement.findOne({ eventId });
    if (!arrangement) {
      console.log('[SEAT:CLEANUP] No arrangement found for event', { eventId });
      return 0;
    }

    let releasedCount = 0;
    const releasedSeats = [];

    // Find and release expired reservations
    for (const seat of arrangement.seats) {
      if (
        seat.status === "RESERVED" &&
        seat.reservationExpiry &&
        seat.reservationExpiry <= now
      ) {
        releasedSeats.push({
          label: seat.label,
          orderId: seat.orderId,
          expiredAt: seat.reservationExpiry,
          expiredBy: Math.round((now - seat.reservationExpiry) / 1000) + 's ago'
        });

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
      console.log('[SEAT:CLEANUP] Released expired reservations', {
        eventId,
        releasedCount,
        releasedSeats,
        newAvailableCount: arrangement.availableSeatsCount,
        newReservedCount: arrangement.reservedSeatsCount
      });
    }

    return releasedCount;
  } catch (error) {
    console.error('[SEAT:CLEANUP] Error during cleanup', {
      eventId,
      error: error.message
    });
    return 0;
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
      .populate("eventId", "name startDate endDate bookingStartDate bookingEndDate mode city")
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
  const operationId = `RSV-${Date.now().toString(36)}`;
  console.log('[SEAT:RESERVE] ========== START ==========', {
    operationId,
    eventId,
    orderId,
    userId,
    seatCount: selectedSeats?.length,
    requestedSeats: selectedSeats?.map(s => ({ label: s.seatLabel, phone: s.phone }))
  });

  // Clean up expired reservations first to make them available
  console.log('[SEAT:RESERVE] Running cleanup before reservation', { operationId, eventId });
  const cleanedUpCount = await cleanupExpiredReservations(eventId);
  console.log('[SEAT:RESERVE] Cleanup completed', { operationId, seatsReleased: cleanedUpCount });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('[SEAT:RESERVE] Fetching seat arrangement', { operationId, eventId });
    const arrangement = await SeatArrangement.findOne({ eventId }).session(
      session
    );
    if (!arrangement) {
      console.error('[SEAT:RESERVE] FAILED - Arrangement not found', { operationId, eventId });
      await session.abortTransaction();
      throw new Error("Seat arrangement not found");
    }

    console.log('[SEAT:RESERVE] Arrangement found', {
      operationId,
      arrangementId: arrangement._id,
      totalSeats: arrangement.totalSeats,
      availableSeats: arrangement.availableSeatsCount,
      reservedSeats: arrangement.reservedSeatsCount,
      bookedSeats: arrangement.bookedSeatsCount
    });

    const now = new Date();
    const reservationExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const requestedLabels = selectedSeats.map((s) => s.seatLabel.toUpperCase().trim());
    const unavailableSeats = [];
    const seatStatusCheck = [];

    console.log('[SEAT:RESERVE] Checking availability for seats', {
      operationId,
      requestedLabels,
      expiryTime: reservationExpiry.toISOString()
    });

    // Check all requested seats are available (expired reservations already cleaned)
    for (const seatLabel of requestedLabels) {
      const seat = arrangement.seats.find((s) => s.label === seatLabel);

      if (!seat) {
        seatStatusCheck.push({ label: seatLabel, status: 'NOT_FOUND' });
        unavailableSeats.push(`${seatLabel} (not found)`);
        continue;
      }

      seatStatusCheck.push({
        label: seatLabel,
        status: seat.status,
        reservedBy: seat.reservedBy,
        orderId: seat.orderId
      });

      // Seat must be AVAILABLE
      if (seat.status !== "AVAILABLE") {
        unavailableSeats.push(`${seatLabel} (${seat.status})`);
      }
    }

    console.log('[SEAT:RESERVE] Availability check results', {
      operationId,
      seatStatusCheck,
      unavailableCount: unavailableSeats.length
    });

    if (unavailableSeats.length > 0) {
      console.error('[SEAT:RESERVE] FAILED - Seats unavailable', {
        operationId,
        unavailableSeats,
        requestedLabels
      });
      await session.abortTransaction();
      throw new Error(
        `Selected seats are no longer available: ${unavailableSeats.join(", ")}`
      );
    }

    console.log('[SEAT:RESERVE] All seats available, reserving now', { operationId });

    // Reserve all requested seats
    const reservedSeatsDetail = [];
    for (const { seatLabel, phone } of selectedSeats) {
      const seat = arrangement.seats.find(
        (s) => s.label === seatLabel.toUpperCase().trim()
      );
      if (seat) {
        const previousStatus = seat.status;
        seat.status = "RESERVED";
        seat.reservedBy = userId;
        seat.reservationExpiry = reservationExpiry;
        seat.orderId = orderId;
        seat.bookedByPhone = normalizePhone(phone); // Store for later

        reservedSeatsDetail.push({
          label: seat.label,
          previousStatus,
          newStatus: seat.status,
          phone: normalizePhone(phone),
          orderId
        });
      }
    }

    console.log('[SEAT:RESERVE] Seats marked as RESERVED', {
      operationId,
      reservedSeats: reservedSeatsDetail
    });

    await arrangement.save({ session });
    await session.commitTransaction();

    console.log('[SEAT:RESERVE] SUCCESS - Transaction committed', {
      operationId,
      orderId,
      eventId,
      reservedCount: requestedLabels.length,
      reservedLabels: requestedLabels,
      expiresAt: reservationExpiry.toISOString()
    });
    console.log('[SEAT:RESERVE] ========== END ==========', { operationId });

    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error('[SEAT:RESERVE] EXCEPTION - Transaction aborted', {
      operationId,
      orderId,
      eventId,
      error: error.message
    });
    console.log('[SEAT:RESERVE] ========== END (ERROR) ==========', { operationId });
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
  const operationId = `CFM-${Date.now().toString(36)}`;
  console.log('[SEAT:CONFIRM] ========== START ==========', {
    operationId,
    orderId,
    enrollmentId
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('[SEAT:CONFIRM] Searching for arrangement with reserved seats', {
      operationId,
      searchCriteria: { 'seats.orderId': orderId }
    });

    const arrangement = await SeatArrangement.findOne({
      "seats.orderId": orderId,
    }).session(session);

    if (!arrangement) {
      console.error('[SEAT:CONFIRM] FAILED - No arrangement found with orderId', {
        operationId,
        orderId
      });
      await session.abortTransaction();
      throw new Error(`No seat reservations found for order ${orderId}`);
    }

    console.log('[SEAT:CONFIRM] Arrangement found', {
      operationId,
      arrangementId: arrangement._id,
      eventId: arrangement.eventId,
      totalSeats: arrangement.totalSeats
    });

    console.log('[SEAT:CONFIRM] Fetching enrollment', { operationId, enrollmentId });
    const enrollment = await EventEnrollment.findById(enrollmentId).session(
      session
    );
    if (!enrollment) {
      console.error('[SEAT:CONFIRM] FAILED - Enrollment not found', {
        operationId,
        enrollmentId
      });
      await session.abortTransaction();
      throw new Error("Enrollment not found");
    }

    console.log('[SEAT:CONFIRM] Enrollment found', {
      operationId,
      enrollmentId,
      userId: enrollment.userId,
      eventId: enrollment.eventId
    });

    // Convert all RESERVED seats with this orderId to BOOKED
    const confirmedSeats = [];
    const skippedSeats = [];

    for (const seat of arrangement.seats) {
      if (seat.status === "RESERVED" && seat.orderId === orderId) {
        confirmedSeats.push({
          label: seat.label,
          previousStatus: seat.status,
          phone: seat.bookedByPhone,
          previousOrderId: seat.orderId
        });

        seat.status = "BOOKED";
        seat.bookedBy = enrollment.userId;
        seat.enrollmentId = enrollmentId;
        // Keep bookedByPhone (already set during reservation)
        // Clear temporary reservation fields
        seat.reservedBy = null;
        seat.reservationExpiry = null;
        seat.orderId = null;
      } else if (seat.orderId === orderId) {
        // Seat has the orderId but status is not RESERVED (unexpected)
        skippedSeats.push({
          label: seat.label,
          status: seat.status,
          reason: 'Status not RESERVED'
        });
      }
    }

    console.log('[SEAT:CONFIRM] Seats status update', {
      operationId,
      confirmedCount: confirmedSeats.length,
      confirmedSeats,
      skippedCount: skippedSeats.length,
      skippedSeats: skippedSeats.length > 0 ? skippedSeats : undefined
    });

    if (confirmedSeats.length === 0) {
      console.warn('[SEAT:CONFIRM] WARNING - No seats were confirmed', {
        operationId,
        orderId,
        possibleReason: 'Seats may have expired or already been processed'
      });
    }

    await arrangement.save({ session });
    await session.commitTransaction();

    console.log('[SEAT:CONFIRM] SUCCESS - Transaction committed', {
      operationId,
      orderId,
      enrollmentId,
      confirmedCount: confirmedSeats.length,
      confirmedLabels: confirmedSeats.map(s => s.label)
    });
    console.log('[SEAT:CONFIRM] ========== END ==========', { operationId });

    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error('[SEAT:CONFIRM] EXCEPTION - Transaction aborted', {
      operationId,
      orderId,
      enrollmentId,
      error: error.message
    });
    console.log('[SEAT:CONFIRM] ========== END (ERROR) ==========', { operationId });
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
  const operationId = `RLS-${Date.now().toString(36)}`;
  console.log('[SEAT:RELEASE] ========== START ==========', {
    operationId,
    orderId
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('[SEAT:RELEASE] Searching for arrangement with reserved seats', {
      operationId,
      searchCriteria: { 'seats.orderId': orderId }
    });

    const arrangement = await SeatArrangement.findOne({
      "seats.orderId": orderId,
    }).session(session);

    if (!arrangement) {
      // No seats to release - this is OK
      console.log('[SEAT:RELEASE] No arrangement found with orderId - nothing to release', {
        operationId,
        orderId
      });
      await session.commitTransaction();
      console.log('[SEAT:RELEASE] ========== END (NO-OP) ==========', { operationId });
      return null;
    }

    console.log('[SEAT:RELEASE] Arrangement found', {
      operationId,
      arrangementId: arrangement._id,
      eventId: arrangement.eventId
    });

    let releasedCount = 0;
    const releasedSeats = [];

    // Release all RESERVED seats with this orderId
    for (const seat of arrangement.seats) {
      if (seat.status === "RESERVED" && seat.orderId === orderId) {
        releasedSeats.push({
          label: seat.label,
          previousStatus: seat.status,
          phone: seat.bookedByPhone
        });

        seat.status = "AVAILABLE";
        seat.reservedBy = null;
        seat.reservationExpiry = null;
        seat.orderId = null;
        seat.bookedByPhone = null;
        releasedCount++;
      }
    }

    console.log('[SEAT:RELEASE] Seats released', {
      operationId,
      releasedCount,
      releasedSeats
    });

    if (releasedCount > 0) {
      await arrangement.save({ session });
    }

    await session.commitTransaction();

    console.log('[SEAT:RELEASE] SUCCESS - Transaction committed', {
      operationId,
      orderId,
      releasedCount,
      releasedLabels: releasedSeats.map(s => s.label)
    });
    console.log('[SEAT:RELEASE] ========== END ==========', { operationId });

    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error('[SEAT:RELEASE] EXCEPTION - Transaction aborted', {
      operationId,
      orderId,
      error: error.message
    });
    console.log('[SEAT:RELEASE] ========== END (ERROR) ==========', { operationId });
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
  const operationId = `CXL-${Date.now().toString(36)}`;
  const normalizedPhone = normalizePhone(phone);

  console.log('[SEAT:CANCEL] ========== START ==========', {
    operationId,
    enrollmentId,
    phone,
    normalizedPhone
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('[SEAT:CANCEL] Searching for booked seat', {
      operationId,
      searchCriteria: {
        'seats.enrollmentId': enrollmentId,
        'seats.bookedByPhone': normalizedPhone
      }
    });

    const arrangement = await SeatArrangement.findOne({
      "seats.enrollmentId": enrollmentId,
      "seats.bookedByPhone": normalizedPhone,
    }).session(session);

    if (!arrangement) {
      // No seat found - this is OK (event might not have seat arrangement)
      console.log('[SEAT:CANCEL] No arrangement found - event may not have seat arrangement', {
        operationId,
        enrollmentId,
        phone: normalizedPhone
      });
      await session.commitTransaction();
      console.log('[SEAT:CANCEL] ========== END (NO-OP) ==========', { operationId });
      return null;
    }

    console.log('[SEAT:CANCEL] Arrangement found', {
      operationId,
      arrangementId: arrangement._id,
      eventId: arrangement.eventId
    });

    // Find and release the specific seat
    const seat = arrangement.seats.find(
      (s) =>
        s.enrollmentId &&
        s.enrollmentId.toString() === enrollmentId.toString() &&
        s.bookedByPhone === normalizedPhone
    );

    if (seat) {
      console.log('[SEAT:CANCEL] Found seat to cancel', {
        operationId,
        label: seat.label,
        previousStatus: seat.status,
        bookedBy: seat.bookedBy,
        enrollmentId: seat.enrollmentId
      });

      seat.status = "AVAILABLE";
      seat.bookedBy = null;
      seat.bookedByPhone = null;
      seat.enrollmentId = null;

      await arrangement.save({ session });

      console.log('[SEAT:CANCEL] Seat cancelled and released', {
        operationId,
        label: seat.label,
        newStatus: 'AVAILABLE'
      });
    } else {
      console.warn('[SEAT:CANCEL] WARNING - Seat not found in arrangement', {
        operationId,
        enrollmentId,
        phone: normalizedPhone,
        availableSeatsWithEnrollment: arrangement.seats
          .filter(s => s.enrollmentId)
          .map(s => ({ label: s.label, enrollmentId: s.enrollmentId, phone: s.bookedByPhone }))
      });
    }

    await session.commitTransaction();

    console.log('[SEAT:CANCEL] SUCCESS - Transaction committed', {
      operationId,
      enrollmentId,
      phone: normalizedPhone,
      seatCancelled: seat ? seat.label : 'none'
    });
    console.log('[SEAT:CANCEL] ========== END ==========', { operationId });

    return arrangement;
  } catch (error) {
    await session.abortTransaction();
    console.error('[SEAT:CANCEL] EXCEPTION - Transaction aborted', {
      operationId,
      enrollmentId,
      phone: normalizedPhone,
      error: error.message
    });
    console.log('[SEAT:CANCEL] ========== END (ERROR) ==========', { operationId });
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
