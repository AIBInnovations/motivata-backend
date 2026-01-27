/**
 * @fileoverview Coupon schema definition with soft delete functionality
 * @module schema/Coupon
 */

import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  /**
   * Unique coupon code
   */
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [3, 'Coupon code must be at least 3 characters'],
    maxlength: [50, 'Coupon code cannot exceed 50 characters']
  },

  /**
   * Discount percentage (0-100)
   */
  discountPercent: {
    type: Number,
    required: [true, 'Discount percentage is required'],
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  /**
   * Maximum discount amount in rupees
   */
  maxDiscountAmount: {
    type: Number,
    required: [true, 'Maximum discount amount is required'],
    min: [0, 'Maximum discount amount cannot be negative']
  },

  /**
   * Minimum purchase amount required to use coupon
   */
  minPurchaseAmount: {
    type: Number,
    required: [true, 'Minimum purchase amount is required'],
    min: [0, 'Minimum purchase amount cannot be negative'],
    default: 0
  },

  /**
   * Maximum number of times this coupon can be used in total
   */
  maxUsageLimit: {
    type: Number,
    default: null, // null means unlimited
    min: [1, 'Usage limit must be at least 1']
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
   * Maximum times a single user can use this coupon
   */
  maxUsagePerUser: {
    type: Number,
    default: 1,
    min: [1, 'Usage per user must be at least 1']
  },

  /**
   * Coupon validity start date
   */
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },

  /**
   * Coupon validity end date
   */
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required'],
    validate: {
      validator: function(value) {
        return value > this.validFrom;
      },
      message: 'Valid until date must be after valid from date'
    }
  },

  /**
   * Description of the coupon
   */
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  /**
   * Where this coupon can be applied
   * EVENT - For event ticket purchases
   * MEMBERSHIP - For membership plan purchases
   * SESSION - For session bookings
   * ALL - Can be used anywhere (default for backward compatibility)
   */
  applicableTo: {
    type: [String],
    enum: {
      values: ['EVENT', 'MEMBERSHIP', 'SESSION', 'SERVICE', 'ALL'],
      message: '{VALUE} is not a valid application type'
    },
    default: ['ALL']
  },

  /**
   * Whether coupon is active
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
couponSchema.index({ code: 1, isDeleted: 1 });
couponSchema.index({ isActive: 1, isDeleted: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ createdAt: -1 });
couponSchema.index({ applicableTo: 1, isActive: 1, isDeleted: 1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
couponSchema.pre(/^find/, function() {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to find deleted coupons
 */
couponSchema.statics.findDeleted = function(filter = {}) {
  return this.find({ ...filter, isDeleted: true })
    .select('+isDeleted +deletedAt +deletedBy');
};

/**
 * Instance method for soft delete
 */
couponSchema.methods.softDelete = function(adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted coupon
 */
couponSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method for permanent delete
 */
couponSchema.statics.permanentDelete = function(id) {
  return this.findByIdAndDelete(id);
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
