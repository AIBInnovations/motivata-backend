/**
 * @fileoverview MembershipRequest schema for tracking membership requests requiring admin approval
 * @module schema/MembershipRequest
 *
 * Flow: User submits form → Admin reviews → Admin approves with plan/amount → Payment link sent → User pays → Membership created
 */

import mongoose from 'mongoose';

const membershipRequestSchema = new mongoose.Schema(
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
     * User's preferred plan (optional - can be overridden by admin)
     */
    requestedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      default: null
    },

    /**
     * Plan assigned by admin on approval
     */
    approvedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      default: null
    },

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
     * Payment amount set by admin (can differ from plan price)
     */
    paymentAmount: {
      type: Number,
      min: [0, 'Payment amount must be positive'],
      default: null
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
     * Razorpay order ID
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
     * Reference to existing user (if phone matches a registered user)
     */
    existingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    /**
     * Reference to created membership (after payment completion)
     */
    userMembershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserMembership',
      default: null
    },

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
membershipRequestSchema.index({ phone: 1, status: 1 });
membershipRequestSchema.index({ status: 1, createdAt: -1 });
membershipRequestSchema.index({ orderId: 1 });
membershipRequestSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

/**
 * Pre-save hook to normalize phone number
 */
membershipRequestSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    // Normalize phone to last 10 digits
    this.phone = this.phone.replace(/\D/g, '').slice(-10);
  }
  next();
});

/**
 * Static: Get pending requests count
 */
membershipRequestSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: 'PENDING', isDeleted: false });
};

/**
 * Static: Check if phone has a pending request
 */
membershipRequestSchema.statics.hasPendingRequest = async function (phone) {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  const request = await this.findOne({
    phone: normalizedPhone,
    status: 'PENDING',
    isDeleted: false
  });
  return !!request;
};

/**
 * Static: Find by order ID (for webhook lookup)
 */
membershipRequestSchema.statics.findByOrderId = function (orderId) {
  return this.findOne({ orderId, isDeleted: false });
};

/**
 * Instance method: Mark as payment sent
 */
membershipRequestSchema.methods.markPaymentSent = async function (paymentData) {
  this.status = 'PAYMENT_SENT';
  this.paymentLinkId = paymentData.paymentLinkId;
  this.paymentUrl = paymentData.paymentUrl;
  this.orderId = paymentData.orderId;
  return this.save();
};

/**
 * Instance method: Mark as completed with membership reference
 */
membershipRequestSchema.methods.markCompleted = async function (paymentId, userMembershipId) {
  this.status = 'COMPLETED';
  this.paymentId = paymentId;
  this.userMembershipId = userMembershipId;
  return this.save();
};

/**
 * Instance method: Approve request (sets plan and amount, ready for payment link)
 */
membershipRequestSchema.methods.approve = async function (adminId, approvedPlanId, paymentAmount, adminNotes = null) {
  this.status = 'APPROVED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.approvedPlanId = approvedPlanId;
  this.paymentAmount = paymentAmount;
  this.adminNotes = adminNotes;
  return this.save();
};

/**
 * Instance method: Reject request
 */
membershipRequestSchema.methods.reject = async function (adminId, rejectionReason, adminNotes = null) {
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
membershipRequestSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Ensure virtual fields are serialized
membershipRequestSchema.set('toJSON', { virtuals: true });
membershipRequestSchema.set('toObject', { virtuals: true });

const MembershipRequest = mongoose.model('MembershipRequest', membershipRequestSchema);

export default MembershipRequest;
