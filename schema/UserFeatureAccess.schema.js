/**
 * @fileoverview UserFeatureAccess schema
 * Tracks per-user, per-feature access purchases and status
 * Phone-based access system with automatic expiry detection
 * @module schema/UserFeatureAccess
 */

import mongoose from 'mongoose';

const userFeatureAccessSchema = new mongoose.Schema(
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
     * User reference (optional - user might not exist at purchase time)
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },

    /**
     * Which feature this grants access to
     */
    featureKey: {
      type: String,
      required: [true, 'Feature key is required'],
      uppercase: true,
      trim: true,
      enum: {
        values: ['SOS', 'CONNECT', 'CHALLENGE'],
        message: '{VALUE} is not a valid feature'
      },
      index: true
    },

    /**
     * Source of this access
     */
    source: {
      type: String,
      enum: ['FEATURE_REQUEST', 'ADMIN_GRANT', 'PROMOTIONAL'],
      default: 'FEATURE_REQUEST'
    },

    /**
     * Reference to the request that created this
     */
    featureRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeatureRequest',
      default: null
    },

    /**
     * Feature pricing reference (for tracking what was purchased)
     */
    featurePricingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeaturePricing',
      default: null
    },

    /**
     * Unique order ID for tracking
     */
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true
    },

    /**
     * Payment ID from Razorpay
     */
    paymentId: {
      type: String,
      trim: true,
      index: true
    },

    /**
     * Amount paid for this feature access
     */
    amountPaid: {
      type: Number,
      required: [true, 'Amount paid is required'],
      min: [0, 'Amount must be a positive number']
    },

    /**
     * Validity Period - Start date
     */
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now
    },

    /**
     * Validity Period - End date (null for lifetime)
     */
    endDate: {
      type: Date,
      required: false,
      default: null,
      index: true
    },

    /**
     * Lifetime access flag
     */
    isLifetime: {
      type: Boolean,
      default: false,
      index: true
    },

    /**
     * Status
     */
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },

    /**
     * Payment Status
     */
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },

    /**
     * Cancellation Details
     */
    cancelledAt: {
      type: Date,
      default: null
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
    },

    /**
     * Pricing Snapshot (at time of purchase)
     */
    pricingSnapshot: {
      name: String,
      description: String,
      durationInDays: Number,
      originalPrice: Number,
      perks: [String]
    },

    /**
     * Admin Notes
     */
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
    },

    /**
     * Metadata for additional info
     */
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * Audit fields
     */
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

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    /**
     * Soft delete
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for common queries
userFeatureAccessSchema.index({ phone: 1, featureKey: 1, status: 1 });
userFeatureAccessSchema.index({ phone: 1, status: 1, isDeleted: 1 });
userFeatureAccessSchema.index({ userId: 1, featureKey: 1, status: 1 });
userFeatureAccessSchema.index({ featureKey: 1, status: 1 });
userFeatureAccessSchema.index({ paymentStatus: 1, status: 1 });
userFeatureAccessSchema.index({ phone: 1, endDate: -1 });

/**
 * Virtual to check if access is currently active
 */
userFeatureAccessSchema.virtual('isCurrentlyActive').get(function () {
  if (this.isDeleted || this.status !== 'ACTIVE' || this.paymentStatus !== 'SUCCESS') {
    return false;
  }

  if (this.isLifetime) {
    return true;
  }

  const now = new Date();
  return this.startDate <= now && this.endDate > now;
});

/**
 * Virtual to check if access is expired
 */
userFeatureAccessSchema.virtual('isExpired').get(function () {
  if (this.isDeleted || this.status === 'CANCELLED' || this.status === 'REFUNDED') {
    return false;
  }

  if (this.isLifetime) {
    return false;
  }

  const now = new Date();
  return this.endDate <= now;
});

/**
 * Virtual for days remaining
 */
userFeatureAccessSchema.virtual('daysRemaining').get(function () {
  if (!this.isCurrentlyActive) {
    return 0;
  }

  if (this.isLifetime) {
    return Infinity;
  }

  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

/**
 * Method to get current status (handles expiry without cron)
 */
userFeatureAccessSchema.methods.getCurrentStatus = function () {
  if (this.isDeleted) {
    return 'DELETED';
  }
  if (this.status === 'CANCELLED' || this.status === 'REFUNDED') {
    return this.status;
  }
  if (this.status === 'PENDING' || this.paymentStatus !== 'SUCCESS') {
    return 'PENDING';
  }

  if (this.isLifetime) {
    const now = new Date();
    if (this.startDate <= now) {
      return 'ACTIVE';
    }
    return 'UPCOMING';
  }

  const now = new Date();
  if (this.endDate <= now) {
    return 'EXPIRED';
  }
  if (this.startDate <= now && this.endDate > now) {
    return 'ACTIVE';
  }
  return 'UPCOMING';
};

/**
 * Method to confirm payment and activate access
 */
userFeatureAccessSchema.methods.confirmPayment = async function (paymentId, userId = null) {
  this.paymentId = paymentId;
  this.paymentStatus = 'SUCCESS';
  this.status = 'ACTIVE';
  if (userId) {
    this.userId = userId;
  }
  await this.save();
};

/**
 * Method to cancel access
 */
userFeatureAccessSchema.methods.cancel = async function (cancelledBy, reason) {
  this.status = 'CANCELLED';
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  await this.save();
};

/**
 * Method to mark as refunded
 */
userFeatureAccessSchema.methods.markAsRefunded = async function () {
  this.status = 'REFUNDED';
  this.paymentStatus = 'REFUNDED';
  this.cancelledAt = new Date();
  this.cancellationReason = 'Payment refunded';
  await this.save();
};

/**
 * Method to extend access
 */
userFeatureAccessSchema.methods.extend = async function (additionalDays) {
  if (this.isLifetime) {
    return; // Cannot extend lifetime access
  }
  const currentEndDate = new Date(this.endDate);
  currentEndDate.setDate(currentEndDate.getDate() + additionalDays);
  this.endDate = currentEndDate;
  await this.save();
};

/**
 * Soft delete method
 */
userFeatureAccessSchema.methods.softDelete = async function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;

  if (this.status === 'ACTIVE' || this.status === 'PENDING') {
    this.status = 'CANCELLED';
    this.cancelledAt = new Date();
    this.cancelledBy = deletedBy;
    this.cancellationReason = 'Deleted by admin';
  }

  await this.save();
};

/**
 * Restore method
 */
userFeatureAccessSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
};

/**
 * Static method to find active access for a phone number and specific feature
 */
userFeatureAccessSchema.statics.findActiveAccess = async function (phone, featureKey) {
  const normalizedPhone = phone.slice(-10);
  const now = new Date();

  const access = await this.findOne({
    phone: normalizedPhone,
    featureKey: featureKey.toUpperCase(),
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    startDate: { $lte: now },
    $or: [
      { isLifetime: true },
      { endDate: { $gt: now } }
    ]
  });

  return access;
};

/**
 * Static method to find all active access for a phone number
 */
userFeatureAccessSchema.statics.findActiveByPhone = async function (phone) {
  const normalizedPhone = phone.slice(-10);
  const now = new Date();

  return this.find({
    phone: normalizedPhone,
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    startDate: { $lte: now },
    $or: [
      { isLifetime: true },
      { endDate: { $gt: now } }
    ]
  });
};

/**
 * Static method to check if phone has active access to specific feature
 */
userFeatureAccessSchema.statics.hasActiveAccess = async function (phone, featureKey) {
  const access = await this.findActiveAccess(phone, featureKey);
  return access !== null;
};

/**
 * Static method to find all access records for a phone
 */
userFeatureAccessSchema.statics.findByPhone = function (phone, includeDeleted = false) {
  const normalizedPhone = phone.slice(-10);
  const query = { phone: normalizedPhone };
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  return this.find(query).sort({ createdAt: -1 }).populate('featurePricingId');
};

/**
 * Static method to find expiring access (for notifications)
 */
userFeatureAccessSchema.statics.findExpiringSoon = function (daysThreshold = 7) {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    isLifetime: false,
    endDate: { $gt: now, $lte: thresholdDate }
  }).populate('featurePricingId userId');
};

/**
 * Static method to auto-expire access (can be called periodically)
 */
userFeatureAccessSchema.statics.autoExpireAccess = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      isDeleted: false,
      status: 'ACTIVE',
      paymentStatus: 'SUCCESS',
      isLifetime: false,
      endDate: { $lte: now }
    },
    {
      $set: { status: 'EXPIRED' }
    }
  );
  return result;
};

// Pre-save hook to normalize phone number
userFeatureAccessSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    this.phone = this.phone.slice(-10);
  }
  next();
});

// Ensure virtual fields are serialized
userFeatureAccessSchema.set('toJSON', { virtuals: true });
userFeatureAccessSchema.set('toObject', { virtuals: true });

const UserFeatureAccess = mongoose.model('UserFeatureAccess', userFeatureAccessSchema);

export default UserFeatureAccess;
