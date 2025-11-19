/**
 * @fileoverview Event schema definition with soft delete functionality
 * @module schema/Event
 */

import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    /**
     * Event name
     */
    name: {
      type: String,
      required: [true, "Event name is required"],
      trim: true,
      maxlength: [200, "Event name cannot exceed 200 characters"],
    },

    /**
     * Event description
     */
    description: {
      type: String,
      required: [true, "Event description is required"],
      maxlength: [5000, "Event description cannot exceed 5000 characters"],
    },

    /**
     * Array of image URLs
     */
    imageUrls: [
      {
        type: String,
        required: false,
        match: [/^https?:\/\/.+/, "Please provide valid image URLs"],
      },
    ],

    /**
     * Thumbnail with image and video URLs
     */
    thumbnail: {
      imageUrl: {
        type: String,
        required: false,
        match: [/^https?:\/\/.+/, "Please provide valid thumbnail image URL"],
      },
      videoUrl: {
        type: String,
        required: false,
        match: [/^https?:\/\/.+/, "Please provide valid thumbnail video URL"],
      },
    },

    /**
     * Event live status - automatically set to false when end date is reached
     */
    isLive: {
      type: Boolean,
      default: true,
    },

    /**
     * Event mode (ONLINE, OFFLINE, HYBRID)
     */
    mode: {
      type: String,
      required: [true, "Event mode is required"],
      enum: {
        values: ["ONLINE", "OFFLINE", "HYBRID"],
        message: "{VALUE} is not a valid mode",
      },
    },

    /**
     * Event location city (required for OFFLINE/HYBRID modes)
     */
    city: {
      type: String,
      required: function () {
        return this.mode === "OFFLINE" || this.mode === "HYBRID";
      },
      trim: true,
    },

    /**
     * Event category
     */
    category: {
      type: String,
      required: [true, "Event category is required"],
      enum: {
        values: [
          "TECHNOLOGY",
          "EDUCATION",
          "MEDICAL",
          "COMEDY",
          "ENTERTAINMENT",
          "BUSINESS",
          "SPORTS",
          "ARTS",
          "MUSIC",
          "FOOD",
          "LIFESTYLE",
          "OTHER",
        ],
        message: "{VALUE} is not a valid category",
      },
    },

    /**
     * Event start date and time
     */
    startDate: {
      type: Date,
      required: [true, "Event start date is required"],
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: "Start date must be in the future",
      },
    },

    /**
     * Event end date - when bookings will close
     */
    endDate: {
      type: Date,
      required: [true, "Event end date is required"],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },

    /**
     * Event pricing
     */
    price: {
      type: Number,
      required: [true, "Event price is required"],
      min: [0, "Price cannot be negative"],
    },

    /**
     * Original price for comparison (for discounts)
     */
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
      validate: {
        validator: function (value) {
          return !value || value >= this.price;
        },
        message:
          "Compare at price must be greater than or equal to current price",
      },
    },

    /**
     * Available seats/slots
     */
    availableSeats: {
      type: Number,
      required: [true, "Available seats is required"],
      min: [1, "At least 1 seat must be available"],
    },

    /**
     * List of applicable coupon IDs
     */
    coupons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],

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
 * Index for improving query performance
 */
eventSchema.index({ isDeleted: 1, isLive: 1 });
eventSchema.index({ category: 1, isDeleted: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ mode: 1, city: 1 });
eventSchema.index({ createdAt: -1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 * Works for find(), findOne(), findOneAndUpdate(), etc.
 */
eventSchema.pre(/^find/, function () {
  // Only add isDeleted filter if not explicitly querying for deleted items
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save middleware to auto-update isLive status
 */
eventSchema.pre("save", function (next) {
  if (this.endDate <= new Date()) {
    this.isLive = false;
  }
  next();
});

/**
 * Static method to find deleted events
 */
eventSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt +deletedBy"
  );
};

/**
 * Instance method for soft delete
 */
eventSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted event
 */
eventSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method for permanent delete
 */
eventSchema.statics.permanentDelete = function (id) {
  return this.findByIdAndDelete(id);
};

/**
 * Method to check and update event status
 */
eventSchema.methods.updateEventStatus = function () {
  const now = new Date();
  if (this.endDate <= now && this.isLive) {
    this.isLive = false;
    return this.save();
  }
  return Promise.resolve(this);
};

/**
 * Static method to update all expired events
 */
eventSchema.statics.updateExpiredEvents = async function () {
  const now = new Date();
  return this.updateMany(
    { endDate: { $lte: now }, isLive: true },
    { $set: { isLive: false } }
  );
};

const Event = mongoose.model("Event", eventSchema);

export default Event;
