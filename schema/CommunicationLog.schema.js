/**
 * @fileoverview Communication Log schema for tracking all outbound communications
 * Universal schema for emails, WhatsApp messages, SMS, and other communications
 * @module schema/CommunicationLog
 */

import mongoose from "mongoose";

const communicationLogSchema = new mongoose.Schema(
  {
    /**
     * Type of communication
     */
    type: {
      type: String,
      required: [true, "Communication type is required"],
      enum: {
        values: ["EMAIL", "WHATSAPP", "SMS", "NOTIFICATION", "OTHER"],
        message: "{VALUE} is not a valid communication type",
      },
      index: true,
    },

    /**
     * Purpose/Category of communication
     */
    category: {
      type: String,
      required: [true, "Communication category is required"],
      enum: {
        values: [
          "TICKET",
          "TICKET_RESHARE",
          "VOUCHER",
          "REDEMPTION_LINK",
          "ENROLLMENT_CONFIRMATION",
          "PAYMENT_CONFIRMATION",
          "REFUND_NOTIFICATION",
          "EVENT_REMINDER",
          "SERVICE_PAYMENT_LINK",
          "MARKETING",
          "TRANSACTIONAL",
          "OTHER",
        ],
        message: "{VALUE} is not a valid communication category",
      },
      index: true,
    },

    /**
     * Recipient phone number or email
     */
    recipient: {
      type: String,
      required: [true, "Recipient is required"],
      trim: true,
      index: true,
    },

    /**
     * Recipient name (optional)
     */
    recipientName: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Status of communication
     */
    status: {
      type: String,
      required: true,
      enum: {
        values: ["SUCCESS", "FAILED", "PENDING"],
        message: "{VALUE} is not a valid status",
      },
      default: "PENDING",
      index: true,
    },

    /**
     * Related event (if applicable)
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },

    /**
     * Related payment/order (if applicable)
     */
    orderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    /**
     * Related user (if applicable)
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /**
     * Related enrollment (if applicable)
     */
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventEnrollment",
      default: null,
      index: true,
    },

    /**
     * Related voucher (if applicable)
     */
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      default: null,
      index: true,
    },

    /**
     * Message ID from provider (email/WhatsApp service)
     */
    messageId: {
      type: String,
      default: null,
      trim: true,
    },

    /**
     * Subject (for emails)
     */
    subject: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Template name used (if any)
     */
    templateName: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Error message (if failed)
     */
    errorMessage: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Additional metadata
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
 * Compound indexes for analytics queries
 */
communicationLogSchema.index({ type: 1, status: 1, createdAt: -1 });
communicationLogSchema.index({ category: 1, createdAt: -1 });
communicationLogSchema.index({ eventId: 1, type: 1 });
communicationLogSchema.index({ createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
communicationLogSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to get communication stats by type
 */
communicationLogSchema.statics.getStatsByType = async function (dateFilter = {}) {
  return this.aggregate([
    { $match: { isDeleted: false, ...dateFilter } },
    {
      $group: {
        _id: "$type",
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
        },
        failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
      },
    },
  ]);
};

/**
 * Static method to get communication stats by category
 */
communicationLogSchema.statics.getStatsByCategory = async function (
  dateFilter = {}
) {
  return this.aggregate([
    { $match: { isDeleted: false, ...dateFilter } },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
        },
        failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
      },
    },
  ]);
};

/**
 * Static method to find deleted records
 */
communicationLogSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt"
  );
};

/**
 * Instance method for soft delete
 */
communicationLogSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Instance method to restore soft deleted record
 */
communicationLogSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

const CommunicationLog = mongoose.model(
  "CommunicationLog",
  communicationLogSchema
);

export default CommunicationLog;
