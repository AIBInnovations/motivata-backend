/**
 * @fileoverview Session Booking schema for tracking user session bookings
 * @module schema/SessionBooking
 */

import mongoose from "mongoose";

/**
 * Generate unique booking reference
 * @returns {string} Booking reference (SB-XXXXXX)
 */
const generateBookingReference = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let ref = "SB-";
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
};

const sessionBookingSchema = new mongoose.Schema(
  {
    /**
     * User who made the booking
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    /**
     * Session being booked
     */
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: [true, "Session ID is required"],
    },

    /**
     * Unique booking reference number (auto-generated in pre-save hook)
     */
    bookingReference: {
      type: String,
      unique: true,
    },

    /**
     * Booking status
     */
    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "confirmed",
          "scheduled",
          "completed",
          "cancelled",
          "no_show",
        ],
        message: "{VALUE} is not a valid booking status",
      },
      default: "pending",
    },

    /**
     * Preferred contact method
     */
    contactMethod: {
      type: String,
      enum: ["email", "whatsapp", "both"],
      default: "both",
    },

    /**
     * User email for booking communication
     */
    userEmail: {
      type: String,
      required: [true, "User email is required"],
      trim: true,
      lowercase: true,
    },

    /**
     * User phone for booking communication
     */
    userPhone: {
      type: String,
      required: [true, "User phone is required"],
      trim: true,
    },

    /**
     * Calendly event URI (if scheduled via Calendly)
     */
    calendlyEventUri: {
      type: String,
      trim: true,
    },

    /**
     * Scheduled slot time
     */
    scheduledSlot: {
      type: Date,
    },

    /**
     * Payment status
     */
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "free"],
      default: "pending",
    },

    /**
     * Reference to payment record
     */
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },

    /**
     * Amount paid for the session
     */
    amountPaid: {
      type: Number,
      min: 0,
    },

    /**
     * Notes from the user
     */
    userNotes: {
      type: String,
      maxlength: [1000, "User notes cannot exceed 1000 characters"],
    },

    /**
     * Admin notes
     */
    adminNotes: {
      type: String,
      maxlength: [1000, "Admin notes cannot exceed 1000 characters"],
    },

    /**
     * Cancellation timestamp
     */
    cancelledAt: {
      type: Date,
    },

    /**
     * Reason for cancellation
     */
    cancellationReason: {
      type: String,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },

    /**
     * Who cancelled the booking
     */
    cancelledBy: {
      type: String,
      enum: ["user", "admin", "host"],
    },

    /**
     * When the booking was made
     */
    bookedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 */
// sessionBookingSchema.index({ userId: 1, sessionId: 1 });
// sessionBookingSchema.index({ userId: 1, status: 1 });
// sessionBookingSchema.index({ sessionId: 1, status: 1 });
// sessionBookingSchema.index({ status: 1 });
// sessionBookingSchema.index({ bookingReference: 1 }, { unique: true });
// sessionBookingSchema.index({ bookedAt: -1 });

/**
 * Pre-save middleware to generate booking reference if not exists
 */
sessionBookingSchema.pre("save", async function (next) {
  if (!this.bookingReference) {
    let isUnique = false;
    let ref;

    while (!isUnique) {
      ref = generateBookingReference();
      const exists = await mongoose.models.SessionBooking.findOne({
        bookingReference: ref,
      });
      if (!exists) isUnique = true;
    }

    this.bookingReference = ref;
  }
  next();
});

/**
 * Instance method to cancel booking
 * @param {string} cancelledBy - Who cancelled (user/admin/host)
 * @param {string} reason - Cancellation reason
 * @returns {Promise<SessionBooking>} Updated booking
 */
sessionBookingSchema.methods.cancel = function (cancelledBy, reason) {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  return this.save();
};

/**
 * Instance method to confirm booking
 * @returns {Promise<SessionBooking>} Updated booking
 */
sessionBookingSchema.methods.confirm = function () {
  this.status = "confirmed";
  return this.save();
};

/**
 * Instance method to mark as scheduled
 * @param {Date} scheduledSlot - Scheduled time slot
 * @param {string} calendlyEventUri - Calendly event URI
 * @returns {Promise<SessionBooking>} Updated booking
 */
sessionBookingSchema.methods.schedule = function (
  scheduledSlot,
  calendlyEventUri
) {
  this.status = "scheduled";
  this.scheduledSlot = scheduledSlot;
  if (calendlyEventUri) {
    this.calendlyEventUri = calendlyEventUri;
  }
  return this.save();
};

/**
 * Instance method to mark as completed
 * @returns {Promise<SessionBooking>} Updated booking
 */
sessionBookingSchema.methods.complete = function () {
  this.status = "completed";
  return this.save();
};

/**
 * Static method to find user's active bookings
 * @param {ObjectId} userId - User ID
 * @returns {Query} Mongoose query
 */
sessionBookingSchema.statics.findActiveByUser = function (userId) {
  return this.find({
    userId,
    status: { $in: ["pending", "confirmed", "scheduled"] },
  }).populate("sessionId");
};

/**
 * Static method to find bookings by session
 * @param {ObjectId} sessionId - Session ID
 * @param {string} status - Optional status filter
 * @returns {Query} Mongoose query
 */
sessionBookingSchema.statics.findBySession = function (sessionId, status) {
  const query = { sessionId };
  if (status) {
    query.status = status;
  }
  return this.find(query).populate("userId", "name email phone");
};

const SessionBooking = mongoose.model("SessionBooking", sessionBookingSchema);

export default SessionBooking;
