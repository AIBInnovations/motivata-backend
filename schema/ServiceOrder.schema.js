import mongoose from "mongoose";
import crypto from "crypto";

/**
 * ServiceOrder Schema
 * Tracks payment orders for service subscriptions
 * Created when admin generates payment link or user request is approved
 */
const serviceOrderSchema = new mongoose.Schema(
  {
    /**
     * Phone number of the customer (required)
     * Used to link to user after payment
     */
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Name of the customer (optional, for display)
     */
    customerName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    /**
     * Services included in this order
     */
    services: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          required: true,
        },
        serviceName: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        durationInDays: {
          type: Number,
          default: null,
        },
      },
    ],
    /**
     * Total amount for all services (original amount before discount)
     */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * Original amount before any discount (same as totalAmount, for consistency)
     */
    originalAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    /**
     * Coupon code used (if any)
     */
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    /**
     * Discount amount applied
     */
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Final amount after discount (amount actually charged)
     */
    finalAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    /**
     * Order status
     */
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "EXPIRED", "CANCELLED"],
      default: "PENDING",
    },
    /**
     * Source of the order
     */
    source: {
      type: String,
      enum: ["ADMIN", "USER_REQUEST", "DIRECT_PURCHASE"],
      required: true,
    },
    /**
     * Reference to ServiceRequest if created from user request
     */
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
      default: null,
    },
    /**
     * Admin who created/approved this order
     */
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    /**
     * Our internal order ID (used as reference_id in Razorpay)
     */
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Razorpay payment link ID
     */
    paymentLinkId: {
      type: String,
      default: null,
    },
    /**
     * Razorpay payment link URL
     */
    paymentLinkUrl: {
      type: String,
      default: null,
    },
    /**
     * Short payment link (for WhatsApp)
     */
    paymentLinkShortUrl: {
      type: String,
      default: null,
    },
    /**
     * Razorpay payment ID (after successful payment)
     */
    paymentId: {
      type: String,
      default: null,
    },
    /**
     * When the payment link expires
     */
    expiresAt: {
      type: Date,
      required: true,
    },
    /**
     * When payment was completed
     */
    paidAt: {
      type: Date,
      default: null,
    },
    /**
     * WhatsApp message status
     */
    whatsappSent: {
      type: Boolean,
      default: false,
    },
    whatsappSentAt: {
      type: Date,
      default: null,
    },
    whatsappMessageId: {
      type: String,
      default: null,
    },
    /**
     * Whether user exists in our database
     */
    userExists: {
      type: Boolean,
      default: false,
    },
    /**
     * User ID if user exists
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    /**
     * Alternative phone number for payment link notifications (transaction-specific)
     */
    alternativePhone: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null
          return /^\d{10}$/.test(v);
        },
        message: 'Alternative phone must be exactly 10 digits'
      }
    },
    /**
     * Alternative email for payment link notifications (transaction-specific)
     */
    alternativeEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: 'Alternative email must be valid'
      }
    },
    /**
     * Contact preference for payment link notifications
     * Valid: ['REGISTERED'], ['ALTERNATIVE'], or ['REGISTERED', 'ALTERNATIVE']
     */
    contactPreference: {
      type: [String],
      enum: ['REGISTERED', 'ALTERNATIVE'],
      default: ['REGISTERED'],
      validate: {
        validator: function (arr) {
          return arr && arr.length > 0 && arr.length <= 2;
        },
        message: 'Must select at least one contact preference'
      }
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceOrderSchema.index({ phone: 1, status: 1 });
serviceOrderSchema.index({ orderId: 1 }, { unique: true });
serviceOrderSchema.index({ paymentLinkId: 1 });
serviceOrderSchema.index({ status: 1, createdAt: -1 });
serviceOrderSchema.index({ adminId: 1, createdAt: -1 });
serviceOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for cleanup

/**
 * Generate unique order ID
 */
serviceOrderSchema.statics.generateOrderId = function () {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(4).toString("hex");
  return `SVC_${timestamp}_${randomPart}`.toUpperCase();
};

/**
 * Mark order as successful
 */
serviceOrderSchema.methods.markAsSuccess = async function (paymentId) {
  this.status = "SUCCESS";
  this.paymentId = paymentId;
  this.paidAt = new Date();
  return this.save();
};

/**
 * Mark order as failed
 */
serviceOrderSchema.methods.markAsFailed = async function (reason) {
  this.status = "FAILED";
  this.metadata = {
    ...this.metadata,
    failureReason: reason,
  };
  return this.save();
};

/**
 * Mark order as expired
 */
serviceOrderSchema.methods.markAsExpired = async function () {
  this.status = "EXPIRED";
  return this.save();
};

/**
 * Update WhatsApp sent status
 */
serviceOrderSchema.methods.markWhatsAppSent = async function (messageId) {
  this.whatsappSent = true;
  this.whatsappSentAt = new Date();
  this.whatsappMessageId = messageId;
  return this.save();
};

/**
 * Get service names as comma-separated string
 */
serviceOrderSchema.methods.getServiceNamesString = function () {
  return this.services.map((s) => s.serviceName).join(", ");
};

export default mongoose.model("ServiceOrder", serviceOrderSchema);
