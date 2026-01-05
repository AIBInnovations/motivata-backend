/**
 * @fileoverview Session schema definition with soft delete functionality
 * @module schema/Session
 */

import mongoose from "mongoose";
import { nowIST } from "../utils/timezone.util.js";

/**
 * @typedef {Object} Session
 * @property {string} title - Session title/name
 * @property {string} shortDescription - Brief description of the session
 * @property {string} longDescription - Detailed description of the session
 * @property {number} price - Session price
 * @property {number} [compareAtPrice] - Original price for comparison (discounts)
 * @property {number} duration - Session duration in minutes
 * @property {string} sessionType - Type of session (OTO: One-to-One, OTM: One-to-Many)
 * @property {boolean} isLive - Whether session is currently available for booking
 * @property {string} host - Name of the session host
 * @property {number} [availableSlots] - Number of available booking slots
 * @property {string} [calendlyLink] - Calendly booking link
 * @property {Date} [sessionDate] - Specific date for the session (optional)
 * @property {mongoose.Types.ObjectId} createdBy - Admin who created the session
 * @property {mongoose.Types.ObjectId} [updatedBy] - Admin who last updated the session
 * @property {boolean} isDeleted - Soft delete flag
 * @property {Date} [deletedAt] - Deletion timestamp
 * @property {mongoose.Types.ObjectId} [deletedBy] - Admin who deleted the session
 */
const sessionSchema = new mongoose.Schema(
  {
    /**
     * Session title/name
     */
    title: {
      type: String,
      required: [true, "Session title is required"],
      trim: true,
      maxlength: [200, "Session title cannot exceed 200 characters"],
    },

    /**
     * Brief description of the session
     */
    shortDescription: {
      type: String,
      required: [true, "Short description is required"],
      trim: true,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },

    /**
     * Detailed description of the session
     */
    longDescription: {
      type: String,
      required: [true, "Long description is required"],
      maxlength: [5000, "Long description cannot exceed 5000 characters"],
    },

    /**
     * Session price
     */
    price: {
      type: Number,
      required: [true, "Session price is required"],
      min: [0, "Price cannot be negative"],
    },

    /**
     * Original price for comparison (for discounts)
     * Note: Validation against price is done in controller to avoid
     * Mongoose update operation issues where 'this' refers to old document state
     */
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
    },

    /**
     * Session duration in minutes
     */
    duration: {
      type: Number,
      required: [true, "Session duration is required"],
      min: [1, "Duration must be at least 1 minute"],
      max: [480, "Duration cannot exceed 480 minutes (8 hours)"],
    },

    /**
     * Session type - One-to-One (OTO) or One-to-Many (OTM)
     */
    sessionType: {
      type: String,
      required: [true, "Session type is required"],
      enum: {
        values: ["OTO", "OTM"],
        message: "{VALUE} is not a valid session type. Use OTO (One-to-One) or OTM (One-to-Many)",
      },
    },

    /**
     * Session category
     */
    category: {
      type: String,
      required: [true, "Session category is required"],
      enum: {
        values: [
          "therapeutic",
          "personal_development",
          "health",
          "mental_wellness",
          "career",
          "relationships",
          "spirituality",
          "other",
        ],
        message: "{VALUE} is not a valid category",
      },
    },

    /**
     * Whether session is currently available for booking
     */
    isLive: {
      type: Boolean,
      default: true,
    },

    /**
     * Name of the session host
     */
    host: {
      type: String,
      required: [true, "Host name is required"],
      trim: true,
      maxlength: [100, "Host name cannot exceed 100 characters"],
    },

    /**
     * Host email
     */
    hostEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    /**
     * Host phone number
     */
    hostPhone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"],
    },

    /**
     * Session tags for search/filtering
     */
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
      },
    ],

    /**
     * Number of available booking slots (mainly for OTM sessions)
     */
    availableSlots: {
      type: Number,
      min: [0, "Available slots cannot be negative"],
      validate: {
        validator: function (value) {
          // For OTO sessions, slots should be 1 or not specified
          if (this.sessionType === "OTO" && value && value > 1) {
            return false;
          }
          return true;
        },
        message: "One-to-One sessions can only have 1 slot",
      },
    },

    /**
     * Number of slots already booked
     */
    bookedSlots: {
      type: Number,
      default: 0,
      min: [0, "Booked slots cannot be negative"],
    },

    /**
     * Calendly event type URI (links to specific Calendly event type)
     */
    calendlyEventTypeUri: {
      type: String,
      trim: true,
    },

    /**
     * Calendly booking link (public scheduling URL)
     * This will be auto-populated from calendlyEventTypeUri if provided
     */
    calendlyLink: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid Calendly URL"],
    },

    /**
     * Specific date for the session (optional - for scheduled sessions)
     */
    sessionDate: {
      type: Date,
      required: false,
    },

    /**
     * Thumbnail/cover image URL
     */
    imageUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },

    /**
     * Created by (admin user)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /**
     * Last updated by (admin user)
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


/**
 * Virtual for discount percentage
 */
sessionSchema.virtual("discountPercent").get(function () {
  if (!this.compareAtPrice || this.compareAtPrice <= this.price) return 0;
  return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
});

/**
 * Index for improving query performance
 */
sessionSchema.index({ isDeleted: 1, isLive: 1 });
sessionSchema.index({ sessionType: 1, isDeleted: 1 });
sessionSchema.index({ category: 1, isDeleted: 1 });
sessionSchema.index({ host: 1, isDeleted: 1 });
sessionSchema.index({ sessionDate: 1 });
sessionSchema.index({ createdAt: -1 });
sessionSchema.index({ price: 1 });
sessionSchema.index({ tags: 1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 * Works for find(), findOne(), findOneAndUpdate(), etc.
 */
sessionSchema.pre(/^find/, function () {
  // Only add isDeleted filter if not explicitly querying for deleted items
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save middleware to validate session data
 */
sessionSchema.pre("save", function (next) {
  // Slot validation removed - unlimited bookings allowed
  next();
});

/**
 * Static method to find deleted sessions
 * @param {Object} filter - Query filter
 * @returns {Query} Mongoose query for deleted sessions
 */
sessionSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt +deletedBy"
  );
};

/**
 * Instance method for soft delete
 * @param {mongoose.Types.ObjectId} adminId - ID of admin performing deletion
 * @returns {Promise<Session>} Updated session document
 */
sessionSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = nowIST();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted session
 * @returns {Promise<Session>} Restored session document
 */
sessionSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method for permanent delete
 * @param {mongoose.Types.ObjectId} id - Session ID to delete
 * @returns {Promise<Session>} Deleted session document
 */
sessionSchema.statics.permanentDelete = function (id) {
  return this.findByIdAndDelete(id);
};


/**
 * Static method to get available sessions
 * @param {Object} filter - Additional query filters
 * @returns {Query} Mongoose query for available sessions
 */
sessionSchema.statics.findAvailable = function (filter = {}) {
  return this.find({
    ...filter,
    isLive: true,
  });
};

const Session = mongoose.model("Session", sessionSchema);

export default Session;
