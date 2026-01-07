import mongoose from "mongoose";

/**
 * ServiceRequest Schema
 * Tracks user-initiated service subscription requests
 * Admin reviews and approves/rejects these requests
 */
const serviceRequestSchema = new mongoose.Schema(
  {
    /**
     * Phone number of the requester
     */
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Name of the requester (optional)
     */
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    /**
     * Email of the requester (optional)
     */
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    /**
     * Services requested
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
      },
    ],
    /**
     * Total amount for all requested services
     */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * Request status
     */
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    /**
     * Whether user with this phone exists in our database
     * Populated at request creation time
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
     * Admin who reviewed this request
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    /**
     * When the request was reviewed
     */
    reviewedAt: {
      type: Date,
      default: null,
    },
    /**
     * Reason for rejection (if rejected)
     */
    rejectionReason: {
      type: String,
      maxlength: 500,
      default: null,
    },
    /**
     * Service order created after approval
     */
    serviceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceOrder",
      default: null,
    },
    /**
     * User's note/message with the request
     */
    userNote: {
      type: String,
      maxlength: 1000,
      default: null,
    },
    /**
     * Admin's internal notes
     */
    adminNotes: {
      type: String,
      maxlength: 1000,
      default: null,
    },
    /**
     * Additional metadata
     */
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
serviceRequestSchema.index({ phone: 1, status: 1 });
serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ reviewedBy: 1, reviewedAt: -1 });
serviceRequestSchema.index({ userExists: 1, status: 1 });

/**
 * Approve request
 */
serviceRequestSchema.methods.approve = async function (adminId, serviceOrderId) {
  this.status = "APPROVED";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.serviceOrderId = serviceOrderId;
  return this.save();
};

/**
 * Reject request
 */
serviceRequestSchema.methods.reject = async function (adminId, reason) {
  this.status = "REJECTED";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

/**
 * Get service names as comma-separated string
 */
serviceRequestSchema.methods.getServiceNamesString = function () {
  return this.services.map((s) => s.serviceName).join(", ");
};

/**
 * Static: Get pending requests count
 */
serviceRequestSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: "PENDING" });
};

/**
 * Static: Get requests by phone
 */
serviceRequestSchema.statics.findByPhone = function (phone) {
  const normalizedPhone = phone.slice(-10);
  return this.find({ phone: normalizedPhone }).sort({ createdAt: -1 });
};

export default mongoose.model("ServiceRequest", serviceRequestSchema);
