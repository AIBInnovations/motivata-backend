/**
 * @fileoverview SeatArrangement schema for event seat management
 * @module schema/SeatArrangement
 */

import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    /**
     * Seat label/number (e.g., "A1", "B12", "VIP-1")
     */
    label: {
      type: String,
      required: [true, "Seat label is required"],
      trim: true,
      uppercase: true,
      maxlength: [10, "Seat label cannot exceed 10 characters"],
    },

    /**
     * Seat status
     */
    status: {
      type: String,
      required: true,
      enum: {
        values: ["AVAILABLE", "RESERVED", "BOOKED", "CANCELLED"],
        message: "{VALUE} is not a valid seat status",
      },
      default: "AVAILABLE",
    },

    /**
     * User who booked this seat (final booking)
     */
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Phone number of ticket holder (normalized to 10 digits)
     */
    bookedByPhone: {
      type: String,
      default: null,
      match: [/^[0-9]{10}$/, "Phone number must be 10 digits"],
    },

    /**
     * User who reserved this seat (temporary reservation)
     */
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * When the reservation expires (15 minutes from creation)
     */
    reservationExpiry: {
      type: Date,
      default: null,
    },

    /**
     * Enrollment this seat belongs to (when booked)
     */
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventEnrollment",
      default: null,
    },

    /**
     * Payment order ID (for tracking during reservation)
     */
    orderId: {
      type: String,
      default: null,
    },
  },
  { _id: false } // Don't create separate _id for subdocuments
);

const seatArrangementSchema = new mongoose.Schema(
  {
    /**
     * Reference to the event
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
      unique: true,
    },

    /**
     * URL of the seat arrangement image
     */
    imageUrl: {
      type: String,
      required: [true, "Seat arrangement image URL is required"],
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },

    /**
     * Array of seats in this arrangement
     */
    seats: {
      type: [seatSchema],
      required: true,
      validate: {
        validator: function (seats) {
          return seats && seats.length > 0;
        },
        message: "At least one seat is required",
      },
    },

    /**
     * Total number of seats (auto-calculated)
     */
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "Total seats must be at least 1"],
    },

    /**
     * Number of available seats (auto-calculated)
     */
    availableSeatsCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Available seats count cannot be negative"],
    },

    /**
     * Number of booked seats
     */
    bookedSeatsCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Booked seats count cannot be negative"],
    },

    /**
     * Number of reserved seats (temporary)
     */
    reservedSeatsCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Reserved seats count cannot be negative"],
    },

    /**
     * Admin who created this arrangement
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "Created by admin ID is required"],
    },

    /**
     * Admin who last updated this arrangement
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for performance
 */
seatArrangementSchema.index({ eventId: 1 }, { unique: true });
seatArrangementSchema.index({ "seats.status": 1 });
seatArrangementSchema.index({ "seats.reservationExpiry": 1 });
seatArrangementSchema.index({ "seats.bookedByPhone": 1 });
seatArrangementSchema.index({ "seats.orderId": 1 });

/**
 * Pre-save middleware to validate unique seat labels and calculate counts
 */
seatArrangementSchema.pre("save", function (next) {
  try {
    // Validate unique seat labels
    const labels = this.seats.map((seat) => seat.label.toUpperCase());
    const uniqueLabels = new Set(labels);

    if (labels.length !== uniqueLabels.size) {
      return next(new Error("Seat labels must be unique"));
    }

    // Calculate counts
    this.totalSeats = this.seats.length;
    this.availableSeatsCount = this.seats.filter(
      (seat) => seat.status === "AVAILABLE"
    ).length;
    this.bookedSeatsCount = this.seats.filter(
      (seat) => seat.status === "BOOKED"
    ).length;
    this.reservedSeatsCount = this.seats.filter(
      (seat) => seat.status === "RESERVED"
    ).length;

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to find seat by label
 */
seatArrangementSchema.methods.findSeatByLabel = function (label) {
  return this.seats.find(
    (seat) => seat.label.toUpperCase() === label.toUpperCase()
  );
};

/**
 * Instance method to get available seats
 */
seatArrangementSchema.methods.getAvailableSeats = function () {
  const now = new Date();
  return this.seats.filter(
    (seat) =>
      seat.status === "AVAILABLE" ||
      (seat.status === "RESERVED" && seat.reservationExpiry < now)
  );
};

/**
 * Static method to find arrangement by event ID
 */
seatArrangementSchema.statics.findByEventId = function (eventId) {
  return this.findOne({ eventId });
};

const SeatArrangement = mongoose.model(
  "SeatArrangement",
  seatArrangementSchema
);

export default SeatArrangement;
