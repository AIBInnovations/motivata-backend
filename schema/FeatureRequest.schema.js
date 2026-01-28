/**
 * @fileoverview FeatureRequest schema for tracking feature access purchase requests requiring admin approval
 * @module schema/FeatureRequest
 *
 * Flow: User submits form with selected features → Admin reviews → Admin approves with pricing/duration → Payment link sent → User pays → Feature access created
 */

import mongoose from 'mongoose';

const featureRequestSchema = new mongoose.Schema(
  {
    /**
     * Phone number (normalized to last 10 digits)
     */
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: 'Phone must be exactly 10 digits (normalized)'
      },
      index: true
    },

    /**
     * User's name from form submission
     */
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      set: (value) => {
        if (!value) return value;
        return value
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    },

    /**
     * Selected features (array to support multi-select)
     */
    requestedFeatures: [{
      featureKey: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        enum: {
          values: ['SOS', 'CONNECT', 'CHALLENGE'],
          message: '{VALUE} is not a valid feature'
        }
      },
      featurePricingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeaturePricing',
        default: null
      }
    }],

    /**
     * If user selected a bundle instead of individual features
     */
    requestedBundleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeaturePricing',
      default: null
    },

    /**
     * Features approved by admin (may differ from requested)
     */
    approvedFeatures: [{
      type: String,
      uppercase: true,
      trim: true,
      enum: {
        values: ['SOS', 'CONNECT', 'CHALLENGE'],
        message: '{VALUE} is not a valid feature'
      }
    }],

    /**
     * Request status
     */
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAYMENT_SENT', 'COMPLETED'],
      default: 'PENDING',
      index: true
    },

    /**
     * Admin who reviewed this request
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },

    /**
     * When the request was reviewed
     */
    reviewedAt: {
      type: Date,
      default: null
    },

    /**
     * Reason for rejection (if rejected)
     */
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
      default: null
    },

    /**
     * Admin's internal notes
     */
    adminNotes: {
      type: String,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters'],
      default: null
    },

    /**
     * Original total price before any discount
     */
    originalAmount: {
      type: Number,
      min: [0, 'Original amount must be positive'],
      default: null
    },

    /**
     * Payment amount set by admin (final amount after discount)
     */
    paymentAmount: {
      type: Number,
      min: [0, 'Payment amount must be positive'],
      default: null
    },

    /**
     * Coupon reference (if coupon was applied)
     */
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null
    },

    /**
     * Coupon code used (stored for reference even if coupon is deleted)
     */
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    /**
     * Discount percentage from the coupon
     */
    discountPercent: {
      type: Number,
      min: [0, 'Discount percent must be positive'],
      max: [100, 'Discount percent cannot exceed 100'],
      default: 0
    },

    /**
     * Calculated discount amount (how much user saved)
     */
    discountAmount: {
      type: Number,
      min: [0, 'Discount amount must be positive'],
      default: 0
    },

    /**
     * Razorpay payment link ID
     */
    paymentLinkId: {
      type: String,
      trim: true,
      default: null
    },

    /**
     * Razorpay payment link short URL
     */
    paymentUrl: {
      type: String,
      trim: true,
      default: null
    },

    /**
     * Unique order ID for tracking
     */
    orderId: {
      type: String,
      trim: true,
      index: true,
      default: null
    },

    /**
     * Razorpay payment ID (after payment completion)
     */
    paymentId: {
      type: String,
      trim: true,
      default: null
    },

    /**
     * Duration for access in days (set during approval)
     */
    durationInDays: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          return value === null || value === 0 || value > 0;
        },
        message: 'Duration must be null/0 (lifetime) or a positive number'
      }
    },

    /**
     * Reference to existing user (if phone matches a registered user)
     */
    existingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    /**
     * References to created UserFeatureAccess records (after payment completion)
     */
    userFeatureAccessIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFeatureAccess'
    }],

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    /**
     * Soft delete timestamp
     */
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

/**
 * Indexes for performance
 */
featureRequestSchema.index({ phone: 1, status: 1 });
featureRequestSchema.index({ status: 1, createdAt: -1 });
featureRequestSchema.index({ orderId: 1 });
featureRequestSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
featureRequestSchema.index({ 'requestedFeatures.featureKey': 1 });

/**
 * Pre-save hook to normalize phone number
 */
featureRequestSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    this.phone = this.phone.replace(/\D/g, '').slice(-10);
  }
  next();
});

/**
 * Static: Get pending requests count
 */
featureRequestSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: 'PENDING', isDeleted: false });
};

/**
 * Static: Check if phone has a pending request
 */
featureRequestSchema.statics.hasPendingRequest = async function (phone) {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  const request = await this.findOne({
    phone: normalizedPhone,
    status: 'PENDING',
    isDeleted: false
  });
  return !!request;
};

/**
 * Static: Check if phone has a pending request for specific features
 */
featureRequestSchema.statics.hasPendingRequestForFeatures = async function (phone, featureKeys) {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  const upperKeys = featureKeys.map(k => k.toUpperCase());

  const request = await this.findOne({
    phone: normalizedPhone,
    status: 'PENDING',
    isDeleted: false,
    'requestedFeatures.featureKey': { $in: upperKeys }
  });
  return !!request;
};

/**
 * Static: Find by order ID (for webhook lookup)
 */
featureRequestSchema.statics.findByOrderId = function (orderId) {
  return this.findOne({ orderId, isDeleted: false });
};

/**
 * Instance method: Mark as payment sent
 */
featureRequestSchema.methods.markPaymentSent = async function (paymentData) {
  this.status = 'PAYMENT_SENT';
  this.paymentLinkId = paymentData.paymentLinkId;
  this.paymentUrl = paymentData.paymentUrl;
  this.orderId = paymentData.orderId;
  return this.save();
};

/**
 * Instance method: Mark as completed with feature access references
 */
featureRequestSchema.methods.markCompleted = async function (paymentId, userFeatureAccessIds) {
  this.status = 'COMPLETED';
  this.paymentId = paymentId;
  this.userFeatureAccessIds = userFeatureAccessIds;
  return this.save();
};

/**
 * Instance method: Approve request
 * @param {ObjectId} adminId - Admin who approved
 * @param {Array} approvedFeatures - Array of feature keys to grant
 * @param {number} paymentAmount - Final amount to pay (after discount)
 * @param {number} durationInDays - Duration for access
 * @param {string} adminNotes - Optional admin notes
 * @param {Object} couponInfo - Optional coupon info { couponId, couponCode, discountPercent, discountAmount, originalAmount }
 */
featureRequestSchema.methods.approve = async function (
  adminId,
  approvedFeatures,
  paymentAmount,
  durationInDays,
  adminNotes = null,
  couponInfo = null
) {
  this.status = 'APPROVED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.approvedFeatures = approvedFeatures;
  this.paymentAmount = paymentAmount;
  this.durationInDays = durationInDays;
  this.adminNotes = adminNotes;

  if (couponInfo) {
    this.couponId = couponInfo.couponId || null;
    this.couponCode = couponInfo.couponCode || null;
    this.discountPercent = couponInfo.discountPercent || 0;
    this.discountAmount = couponInfo.discountAmount || 0;
    this.originalAmount = couponInfo.originalAmount || paymentAmount;
  } else {
    this.originalAmount = paymentAmount;
  }

  return this.save();
};

/**
 * Instance method: Reject request
 */
featureRequestSchema.methods.reject = async function (adminId, rejectionReason, adminNotes = null) {
  this.status = 'REJECTED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = rejectionReason;
  this.adminNotes = adminNotes;
  return this.save();
};

/**
 * Instance method: Soft delete
 */
featureRequestSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Virtual: Get requested feature keys as array
 */
featureRequestSchema.virtual('requestedFeatureKeys').get(function () {
  return this.requestedFeatures.map(f => f.featureKey);
});

// Ensure virtual fields are serialized
featureRequestSchema.set('toJSON', { virtuals: true });
featureRequestSchema.set('toObject', { virtuals: true });

const FeatureRequest = mongoose.model('FeatureRequest', featureRequestSchema);

export default FeatureRequest;
