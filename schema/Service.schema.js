import mongoose from "mongoose";

/**
 * Service Schema
 * Represents services that users can subscribe to
 * Admin-managed through admin panel
 */
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    /**
     * Duration in days (for time-based services)
     * null means lifetime/one-time service
     */
    durationInDays: {
      type: Number,
      min: 1,
      default: null,
    },
    category: {
      type: String,
      enum: [
        "CONSULTATION",
        "COACHING",
        "THERAPY",
        "WELLNESS",
        "FITNESS",
        "EDUCATION",
        "OTHER",
      ],
      default: "OTHER",
    },
    imageUrl: {
      type: String,
      default: null,
    },
    /**
     * Perks/benefits of this service
     */
    perks: [
      {
        type: String,
        trim: true,
        maxlength: 500,
      },
    ],
    /**
     * Maximum number of subscriptions allowed (null = unlimited)
     */
    maxSubscriptions: {
      type: Number,
      min: 0,
      default: null,
    },
    /**
     * Current active subscription count (denormalized for performance)
     */
    activeSubscriptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Total subscription count (including expired/cancelled)
     */
    totalSubscriptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /**
     * Whether this service requires admin approval before purchase
     * true = User must request, admin approves, then payment link sent
     * false = User can purchase directly without approval
     */
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceSchema.index({ isActive: 1, displayOrder: 1 });
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ isFeatured: 1, isActive: 1 });

/**
 * Check if service has available slots
 */
serviceSchema.methods.hasAvailableSlots = function () {
  if (this.maxSubscriptions === null) return true;
  return this.activeSubscriptionCount < this.maxSubscriptions;
};

/**
 * Increment subscription count
 */
serviceSchema.methods.incrementSubscriptionCount = async function () {
  this.activeSubscriptionCount += 1;
  this.totalSubscriptionCount += 1;
  return this.save();
};

/**
 * Decrement active subscription count (on expiry/cancellation)
 */
serviceSchema.methods.decrementActiveSubscriptionCount = async function () {
  this.activeSubscriptionCount = Math.max(0, this.activeSubscriptionCount - 1);
  return this.save();
};

export default mongoose.model("Service", serviceSchema);
