/**
 * @fileoverview ReferralCode schema
 *
 * A referral code proves a student actually belongs to a college. It is NOT a
 * discount — the price never changes. It only gates checkout on plans marked
 * `requiresReferral`, and tags the resulting membership with its college.
 *
 * Usage is counted on payment success only (webhook), never on validation —
 * otherwise merely checking a code would burn one of its uses.
 *
 * @module schema/ReferralCode
 */

import mongoose from 'mongoose';

const referralCodeSchema = new mongoose.Schema(
  {
    // The college this code belongs to. One college has many codes.
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College is required'],
      index: true
    },

    code: {
      type: String,
      required: [true, 'Referral code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Referral code must be at least 3 characters'],
      maxlength: [50, 'Referral code cannot exceed 50 characters']
    },

    // Total number of successful payments this code allows. null = unlimited.
    // There is deliberately no per-user or per-day cap: the client asked only
    // for a total limit.
    maxUses: {
      type: Number,
      default: null,
      min: [1, 'Max uses must be at least 1']
    },

    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative']
    },

    // Full timestamp, so the admin can set an expiry hours away, not just days.
    // null = never expires.
    expiresAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

referralCodeSchema.index({ isDeleted: 1, isActive: 1 });
referralCodeSchema.index({ collegeId: 1, isDeleted: 1 });

/**
 * Whether this code still has uses left. A null maxUses is unlimited.
 */
referralCodeSchema.virtual('hasUsesLeft').get(function () {
  return this.maxUses === null || this.usedCount < this.maxUses;
});

referralCodeSchema.virtual('isExpired').get(function () {
  return this.expiresAt !== null && this.expiresAt <= new Date();
});

/**
 * Validate a code for use at checkout.
 *
 * Read-only — this never increments usedCount. Returns the populated college so
 * callers can tag the request/membership without a second query.
 *
 * @param {string} code
 * @returns {Promise<{isValid: boolean, referral?: object, college?: object, error?: string}>}
 */
referralCodeSchema.statics.validateCode = async function (code) {
  if (!code || !String(code).trim()) {
    return { isValid: false, error: 'Referral code is required' };
  }

  const referral = await this.findOne({
    code: String(code).trim().toUpperCase(),
    isDeleted: false
  }).populate('collegeId', 'name city isActive isDeleted');

  if (!referral) {
    return { isValid: false, error: 'Invalid referral code' };
  }

  if (!referral.isActive) {
    return { isValid: false, error: 'This referral code is no longer active' };
  }

  const college = referral.collegeId;

  // A code is only as valid as the college behind it — disabling a college must
  // disable all of its codes without editing each one.
  if (!college || college.isDeleted || !college.isActive) {
    return { isValid: false, error: 'This referral code is no longer active' };
  }

  if (referral.expiresAt !== null && referral.expiresAt <= new Date()) {
    return { isValid: false, error: 'This referral code has expired' };
  }

  if (referral.maxUses !== null && referral.usedCount >= referral.maxUses) {
    return { isValid: false, error: 'This referral code has reached its usage limit' };
  }

  return { isValid: true, referral, college };
};

/**
 * Count one successful payment against a code.
 *
 * Atomic: the usage guard is part of the query, so two payments clearing at the
 * same moment can never push usedCount past maxUses.
 *
 * @param {ObjectId|string} referralCodeId
 * @returns {Promise<object|null>} the updated code, or null if it had no uses left
 */
referralCodeSchema.statics.consume = function (referralCodeId) {
  return this.findOneAndUpdate(
    {
      _id: referralCodeId,
      isDeleted: false,
      $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }]
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
};

/**
 * Give a use back when a payment is refunded, so the code is not silently
 * burned. Never drops below zero.
 */
referralCodeSchema.statics.release = function (referralCodeId) {
  return this.findOneAndUpdate(
    { _id: referralCodeId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
    { new: true }
  );
};

referralCodeSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

referralCodeSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

referralCodeSchema.set('toJSON', { virtuals: true });
referralCodeSchema.set('toObject', { virtuals: true });

const ReferralCode = mongoose.model('ReferralCode', referralCodeSchema);

export default ReferralCode;
