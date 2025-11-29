/**
 * @fileoverview Voucher schema definition with soft delete functionality
 * @module schema/Voucher
 */

import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  /**
   * Voucher title
   */
  title: {
    type: String,
    required: [true, 'Voucher title is required'],
    trim: true,
    maxlength: [200, 'Voucher title cannot exceed 200 characters']
  },

  /**
   * Voucher description
   */
  description: {
    type: String,
    required: [true, 'Voucher description is required'],
    trim: true,
    maxlength: [1000, 'Voucher description cannot exceed 1000 characters']
  },

  /**
   * Unique voucher code
   */
  code: {
    type: String,
    required: [true, 'Voucher code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [3, 'Voucher code must be at least 3 characters'],
    maxlength: [50, 'Voucher code cannot exceed 50 characters']
  },

  /**
   * Maximum number of times this voucher can be claimed
   */
  maxUsage: {
    type: Number,
    required: [true, 'Maximum usage is required'],
    min: [1, 'Maximum usage must be at least 1']
  },

  /**
   * Current usage count
   */
  usageCount: {
    type: Number,
    default: 0,
    min: [0, 'Usage count cannot be negative']
  },

  /**
   * List of phone numbers who have claimed this voucher
   */
  claimedPhones: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be exactly 10 digits'
    }
  }],

  /**
   * Associated events (optional - voucher can be limited to specific events)
   */
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],

  /**
   * Whether voucher is active
   */
  isActive: {
    type: Boolean,
    default: true
  },

  /**
   * Created by (admin user)
   */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },

  /**
   * Last updated by (admin user)
   */
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  /**
   * Soft delete flag
   */
  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  },

  /**
   * Deletion timestamp
   */
  deletedAt: {
    type: Date,
    default: null,
    select: false
  },

  /**
   * Who deleted the record
   */
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    select: false
  }
}, {
  timestamps: true
});

/**
 * Indexes for improving query performance
 */
voucherSchema.index({ code: 1, isDeleted: 1 });
voucherSchema.index({ isActive: 1, isDeleted: 1 });
voucherSchema.index({ events: 1 });
voucherSchema.index({ createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
voucherSchema.pre(/^find/, function() {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to find deleted vouchers
 */
voucherSchema.statics.findDeleted = function(filter = {}) {
  return this.find({ ...filter, isDeleted: true })
    .select('+isDeleted +deletedAt +deletedBy');
};

/**
 * Instance method for soft delete
 */
voucherSchema.methods.softDelete = function(adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted voucher
 */
voucherSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method for permanent delete
 */
voucherSchema.statics.permanentDelete = function(id) {
  return this.findByIdAndDelete(id);
};

/**
 * Check if voucher is available for claiming
 */
voucherSchema.methods.isAvailable = function() {
  return this.isActive && this.usageCount < this.maxUsage;
};

/**
 * Check if a phone number has already claimed this voucher
 */
voucherSchema.methods.hasPhoneClaimed = function(phone) {
  const normalizedPhone = phone.slice(-10);
  return this.claimedPhones.includes(normalizedPhone);
};

/**
 * Claim voucher for phone number(s)
 * Atomically increments usage and adds phones to claimed list
 */
voucherSchema.statics.claimVoucher = async function(voucherId, phones) {
  const normalizedPhones = phones.map(p => p.slice(-10));
  const phoneCount = normalizedPhones.length;

  const voucher = await this.findOneAndUpdate(
    {
      _id: voucherId,
      isActive: true,
      isDeleted: false,
      $expr: { $lte: [{ $add: ['$usageCount', phoneCount] }, '$maxUsage'] }
    },
    {
      $inc: { usageCount: phoneCount },
      $push: { claimedPhones: { $each: normalizedPhones } }
    },
    { new: true }
  );

  return voucher;
};

/**
 * Release voucher for phone number(s) - used when payment fails
 * Atomically decrements usage and removes phones from claimed list
 */
voucherSchema.statics.releaseVoucher = async function(voucherId, phones) {
  const normalizedPhones = phones.map(p => p.slice(-10));
  const phoneCount = normalizedPhones.length;

  const voucher = await this.findByIdAndUpdate(
    voucherId,
    {
      $inc: { usageCount: -phoneCount },
      $pull: { claimedPhones: { $in: normalizedPhones } }
    },
    { new: true }
  );

  // Ensure usageCount doesn't go below 0
  if (voucher && voucher.usageCount < 0) {
    voucher.usageCount = 0;
    await voucher.save();
  }

  return voucher;
};

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;
