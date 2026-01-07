import mongoose from "mongoose";

/**
 * UserServiceSubscription Schema
 * Tracks which users are subscribed to which services
 * Created after successful payment confirmation
 */
const userServiceSubscriptionSchema = new mongoose.Schema(
  {
    /**
     * Phone number (always required)
     * This is the primary identifier for the subscription
     */
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * User ID (optional - user may not exist in our system yet)
     * Will be populated when user registers or is found
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /**
     * Service this subscription is for
     */
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    /**
     * Service order that created this subscription
     */
    serviceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceOrder",
      required: true,
    },
    /**
     * Subscription status
     */
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED", "REFUNDED"],
      default: "ACTIVE",
    },
    /**
     * When the subscription started
     */
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    /**
     * When the subscription ends (null for lifetime)
     */
    endDate: {
      type: Date,
      default: null,
    },
    /**
     * Price paid for this subscription
     */
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * Duration in days (copied from service at time of purchase)
     */
    durationInDays: {
      type: Number,
      default: null,
    },
    /**
     * When the subscription was activated (payment confirmed)
     */
    activatedAt: {
      type: Date,
      default: null,
    },
    /**
     * When the subscription was cancelled/expired
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
      maxlength: 500,
      default: null,
    },
    /**
     * Admin who cancelled (if admin-cancelled)
     */
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
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
     * Admin notes
     */
    adminNotes: {
      type: String,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userServiceSubscriptionSchema.index({ phone: 1, serviceId: 1 });
userServiceSubscriptionSchema.index({ userId: 1, status: 1 });
userServiceSubscriptionSchema.index({ serviceId: 1, status: 1 });
userServiceSubscriptionSchema.index({ serviceOrderId: 1 });
userServiceSubscriptionSchema.index({ status: 1, endDate: 1 });
userServiceSubscriptionSchema.index({ phone: 1, status: 1 });

/**
 * Check if subscription is currently active
 */
userServiceSubscriptionSchema.methods.isCurrentlyActive = function () {
  if (this.status !== "ACTIVE") return false;
  if (this.endDate === null) return true; // Lifetime subscription
  return new Date() < this.endDate;
};

/**
 * Activate subscription
 */
userServiceSubscriptionSchema.methods.activate = async function (userId = null) {
  this.status = "ACTIVE";
  this.activatedAt = new Date();
  if (userId) {
    this.userId = userId;
  }
  return this.save();
};

/**
 * Mark subscription as expired
 */
userServiceSubscriptionSchema.methods.markAsExpired = async function () {
  this.status = "EXPIRED";
  this.cancelledAt = new Date();
  this.cancellationReason = "Subscription period ended";
  return this.save();
};

/**
 * Cancel subscription
 */
userServiceSubscriptionSchema.methods.cancel = async function (
  reason,
  adminId = null
) {
  this.status = "CANCELLED";
  this.cancelledAt = new Date();
  this.cancellationReason = reason || "Cancelled";
  if (adminId) {
    this.cancelledBy = adminId;
  }
  return this.save();
};

/**
 * Mark as refunded
 */
userServiceSubscriptionSchema.methods.markAsRefunded = async function () {
  this.status = "REFUNDED";
  this.cancelledAt = new Date();
  this.cancellationReason = "Payment refunded";
  return this.save();
};

/**
 * Link to user (when user is found/created)
 */
userServiceSubscriptionSchema.methods.linkToUser = async function (userId) {
  this.userId = userId;
  return this.save();
};

/**
 * Static: Find active subscriptions for a phone number
 */
userServiceSubscriptionSchema.statics.findActiveByPhone = function (phone) {
  const normalizedPhone = phone.slice(-10);
  return this.find({
    phone: normalizedPhone,
    status: "ACTIVE",
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
  }).populate("serviceId");
};

/**
 * Static: Find active subscriptions for a user
 */
userServiceSubscriptionSchema.statics.findActiveByUserId = function (userId) {
  return this.find({
    userId,
    status: "ACTIVE",
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
  }).populate("serviceId");
};

/**
 * Static: Check if phone has active subscription for a service
 */
userServiceSubscriptionSchema.statics.hasActiveSubscription = async function (
  phone,
  serviceId
) {
  const normalizedPhone = phone.slice(-10);
  const subscription = await this.findOne({
    phone: normalizedPhone,
    serviceId,
    status: "ACTIVE",
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
  });
  return !!subscription;
};

export default mongoose.model(
  "UserServiceSubscription",
  userServiceSubscriptionSchema
);
