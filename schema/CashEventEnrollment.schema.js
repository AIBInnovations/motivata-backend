/**
 * @fileoverview Cash Event Enrollment schema for redeemed offline cash tickets
 * @module schema/CashEventEnrollment
 */

import mongoose from "mongoose";

const cashEventEnrollmentSchema = new mongoose.Schema(
  {
    /**
     * Reference to the event
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    /**
     * Reference to the user
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * Reference to the original OfflineCash record
     */
    offlineCashId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OfflineCash",
      required: true,
    },

    /**
     * Ticket holder phone number (10 digits)
     */
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Phone number must be exactly 10 digits",
      },
    },

    /**
     * Ticket holder name
     */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Ticket status
     */
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED", "REFUNDED"],
      default: "ACTIVE",
    },

    /**
     * When ticket was cancelled
     */
    cancelledAt: {
      type: Date,
      default: null,
    },

    /**
     * Reason for cancellation
     */
    cancellationReason: {
      type: String,
      default: null,
    },

    /**
     * Whether ticket QR has been scanned for entry
     */
    isTicketScanned: {
      type: Boolean,
      default: false,
    },

    /**
     * When ticket was scanned
     */
    ticketScannedAt: {
      type: Date,
      default: null,
    },

    /**
     * Admin who scanned the ticket
     */
    ticketScannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    /**
     * QR ticket link
     */
    ticketLink: {
      type: String,
      default: null,
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
cashEventEnrollmentSchema.index({ eventId: 1, userId: 1 }, { unique: true });
cashEventEnrollmentSchema.index({ eventId: 1, phone: 1 }, { unique: true });
cashEventEnrollmentSchema.index({ offlineCashId: 1 });
cashEventEnrollmentSchema.index({ userId: 1 });
cashEventEnrollmentSchema.index({ status: 1 });
cashEventEnrollmentSchema.index({ createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
cashEventEnrollmentSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to find deleted records
 */
cashEventEnrollmentSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt"
  );
};

/**
 * Instance method for soft delete
 */
cashEventEnrollmentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Instance method to restore
 */
cashEventEnrollmentSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

const CashEventEnrollment = mongoose.model(
  "CashEventEnrollment",
  cashEventEnrollmentSchema
);

export default CashEventEnrollment;
