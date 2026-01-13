/**
 * @fileoverview UserMembership schema
 * Tracks user membership purchases and status
 * Phone-based membership system with automatic expiry detection
 * @module schema/UserMembership
 */

import mongoose from 'mongoose';

const userMembershipSchema = new mongoose.Schema(
  {
    // Phone number (normalized to last 10 digits)
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

    // User reference (optional - user might not exist at purchase time)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },

    // Membership Plan Reference
    membershipPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: [true, 'Membership plan is required'],
      index: true
    },

    // Payment Reference
    paymentId: {
      type: String,
      trim: true,
      index: true
    },

    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true
    },

    // Purchase Details
    purchaseMethod: {
      type: String,
      enum: ['ADMIN', 'IN_APP', 'WEBSITE'],
      required: [true, 'Purchase method is required'],
      default: 'IN_APP'
    },

    amountPaid: {
      type: Number,
      required: [true, 'Amount paid is required'],
      min: [0, 'Amount must be a positive number']
    },

    // Validity Period
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now
    },

    endDate: {
      type: Date,
      required: false, // Not required for lifetime memberships
      default: null,
      index: true
    },

    // Lifetime membership flag
    isLifetime: {
      type: Boolean,
      default: false,
      index: true
    },

    // Status
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },

    // Payment Status
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },

    // Cancellation Details
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

    // Plan Details Snapshot (at time of purchase)
    planSnapshot: {
      name: String,
      description: String,
      durationInDays: Number,
      perks: [String],
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    },

    // Admin Notes
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
    },

    // Metadata for additional info
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    // Soft delete
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
userMembershipSchema.index({ phone: 1, status: 1, isDeleted: 1 });
userMembershipSchema.index({ phone: 1, endDate: -1 });
userMembershipSchema.index({ membershipPlanId: 1, status: 1 });
userMembershipSchema.index({ userId: 1, status: 1, isDeleted: 1 });
userMembershipSchema.index({ paymentStatus: 1, status: 1 });

// Virtual to check if membership is currently active
userMembershipSchema.virtual('isCurrentlyActive').get(function () {
  // Must have successful payment and ACTIVE status
  if (this.isDeleted || this.status !== 'ACTIVE' || this.paymentStatus !== 'SUCCESS') {
    return false;
  }

  // Lifetime memberships never expire by date
  if (this.isLifetime) {
    return true;
  }

  const now = new Date();
  return this.startDate <= now && this.endDate > now;
});

// Virtual to check if membership is expired
userMembershipSchema.virtual('isExpired').get(function () {
  if (this.isDeleted || this.status === 'CANCELLED' || this.status === 'REFUNDED') {
    return false;
  }

  // Lifetime memberships never expire
  if (this.isLifetime) {
    return false;
  }

  const now = new Date();
  return this.endDate <= now;
});

// Virtual for days remaining
userMembershipSchema.virtual('daysRemaining').get(function () {
  if (!this.isCurrentlyActive) {
    return 0;
  }

  // Lifetime memberships return Infinity (never expires)
  if (this.isLifetime) {
    return Infinity;
  }

  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Method to get current status (handles expiry without cron)
userMembershipSchema.methods.getCurrentStatus = function () {
  if (this.isDeleted) {
    return 'DELETED';
  }
  if (this.status === 'CANCELLED' || this.status === 'REFUNDED') {
    return this.status;
  }
  if (this.status === 'PENDING' || this.paymentStatus !== 'SUCCESS') {
    return 'PENDING';
  }

  // Lifetime memberships never expire
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

// Method to confirm payment and activate membership
userMembershipSchema.methods.confirmPayment = async function (paymentId, userId = null) {
  this.paymentId = paymentId;
  this.paymentStatus = 'SUCCESS';
  this.status = 'ACTIVE';
  if (userId) {
    this.userId = userId;
  }
  await this.save();
};

// Method to cancel membership
userMembershipSchema.methods.cancel = async function (cancelledBy, reason) {
  this.status = 'CANCELLED';
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  await this.save();
};

// Method to mark as refunded
userMembershipSchema.methods.markAsRefunded = async function () {
  this.status = 'REFUNDED';
  this.paymentStatus = 'REFUNDED';
  this.cancelledAt = new Date();
  this.cancellationReason = 'Payment refunded';
  await this.save();
};

// Method to extend membership
userMembershipSchema.methods.extend = async function (additionalDays) {
  const currentEndDate = new Date(this.endDate);
  currentEndDate.setDate(currentEndDate.getDate() + additionalDays);
  this.endDate = currentEndDate;
  await this.save();
};

// Soft delete method
userMembershipSchema.methods.softDelete = async function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;

  // Cancel the membership if it's active or pending
  // This ensures deleted memberships don't grant access to features
  if (this.status === 'ACTIVE' || this.status === 'PENDING') {
    this.status = 'CANCELLED';
    this.cancelledAt = new Date();
    this.cancelledBy = deletedBy;
    this.cancellationReason = 'Deleted by admin';
  }

  await this.save();
};

// Restore method
userMembershipSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
};

// Static method to find active membership for a phone number
userMembershipSchema.statics.findActiveMembership = async function (phone) {
  const normalizedPhone = phone.slice(-10);
  const now = new Date();

  const membership = await this.findOne({
    phone: normalizedPhone,
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    startDate: { $lte: now },
    endDate: { $gt: now }
  })
    .sort({ endDate: -1 })
    .populate('membershipPlanId');

  return membership;
};

// Static method to check if phone has active membership
userMembershipSchema.statics.hasActiveMembership = async function (phone) {
  const membership = await this.findActiveMembership(phone);
  return membership !== null;
};

// Static method to find all memberships for a phone
userMembershipSchema.statics.findByPhone = function (phone, includeDeleted = false) {
  const normalizedPhone = phone.slice(-10);
  const query = { phone: normalizedPhone };
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  return this.find(query).sort({ createdAt: -1 }).populate('membershipPlanId');
};

// Static method to find expiring memberships (for notifications)
userMembershipSchema.statics.findExpiringSoon = function (daysThreshold = 7) {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    endDate: { $gt: now, $lte: thresholdDate }
  }).populate('membershipPlanId userId');
};

// Static method to auto-expire memberships (can be called periodically or on-demand)
userMembershipSchema.statics.autoExpireMemberships = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      isDeleted: false,
      status: 'ACTIVE',
      paymentStatus: 'SUCCESS',
      endDate: { $lte: now }
    },
    {
      $set: { status: 'EXPIRED' }
    }
  );
  return result;
};

// Ensure virtual fields are serialized
userMembershipSchema.set('toJSON', { virtuals: true });
userMembershipSchema.set('toObject', { virtuals: true });

// Pre-save hook to normalize phone number
userMembershipSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    // Normalize phone to last 10 digits
    this.phone = this.phone.slice(-10);
  }
  next();
});

const UserMembership = mongoose.model('UserMembership', userMembershipSchema);

export default UserMembership;
