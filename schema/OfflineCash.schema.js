/**
 * @fileoverview Offline Cash schema for cash payment ticket generation
 * @module schema/OfflineCash
 */

import mongoose from "mongoose";

const offlineCashSchema = new mongoose.Schema(
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
     * Phone number of primary ticket holder (10 digits)
     */
    generatedFor: {
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
     * Number of tickets
     */
    ticketCount: {
      type: Number,
      required: true,
      min: [1, "Ticket count must be at least 1"],
    },

    /**
     * Unique 6-character alphanumeric signature (lowercase)
     */
    signature: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v) {
          return /^[a-z0-9]{6}$/.test(v);
        },
        message: "Signature must be 6 lowercase alphanumeric characters",
      },
    },

    /**
     * Price charged for the tickets (optional - admin may not record)
     */
    priceCharged: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },

    /**
     * Generated redemption link
     */
    link: {
      type: String,
      required: true,
    },

    /**
     * Whether tickets have been redeemed
     */
    redeemed: {
      type: Boolean,
      default: false,
    },

    /**
     * When tickets were redeemed
     */
    redeemedAt: {
      type: Date,
      default: null,
    },

    /**
     * Notes about the transaction
     */
    notes: {
      type: String,
      maxlength: 500,
      default: null,
    },

    /**
     * Admin who generated this record
     */
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
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

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
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
offlineCashSchema.index({ eventId: 1, isDeleted: 1 });
offlineCashSchema.index({ generatedFor: 1, eventId: 1 });
offlineCashSchema.index({ signature: 1 }, { unique: true });
offlineCashSchema.index({ generatedBy: 1 });
offlineCashSchema.index({ createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
offlineCashSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Generate unique 6-character alphanumeric signature
 */
offlineCashSchema.statics.generateSignature = async function () {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let signature;
  let isUnique = false;

  while (!isUnique) {
    signature = "";
    for (let i = 0; i < 6; i++) {
      signature += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await this.findOne({ signature });
    if (!existing) {
      isUnique = true;
    }
  }

  return signature;
};

/**
 * Static method to find deleted records
 */
offlineCashSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt +deletedBy"
  );
};

/**
 * Instance method for soft delete
 */
offlineCashSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted record
 */
offlineCashSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

const OfflineCash = mongoose.model("OfflineCash", offlineCashSchema);

export default OfflineCash;
