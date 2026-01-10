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
     * Google Maps link for venue address (optional, relevant for OFFLINE/HYBRID modes)
     */
    gmapLink: {
      type: String,
      trim: true,
      match: [
        /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl)\/.+/,
        "Please provide a valid Google Maps link",
      ],
    },

    /**
     * Featured event flag - featured events are highlighted in the app
     */
    featured: {
      type: Boolean,
      default: false,
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
    },

    /**
     * Event end date - when bookings will close
     */
    endDate: {
      type: Date,
      required: [true, "Event end date is required"],
    },

    /**
     * Booking start date - when users can begin booking tickets
     * If not provided, defaults to event creation time (or now)
     */
    bookingStartDate: {
      type: Date,
      required: false, // Optional - will be auto-filled if not provided
    },

    /**
     * Booking end date - when booking window closes
     * If not provided, defaults to event start date (bookings close when event starts)
     */
    bookingEndDate: {
      type: Date,
      required: false, // Optional - will be auto-filled if not provided
    },

    /**
     * Event duration (kept for backward compatibility)
     */
    duration: {
      type: Number,
      required: false,
      min: [0, "Duration cannot be negative"],
    },

    /**
     * Event pricing (simple pricing - use this OR pricingTiers, not both)
     */
    price: {
      type: Number,
      min: [0, "Price cannot be negative"],
    },

    /**
     * Original price for comparison (for discounts)
     */
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
    },

    /**
     * Multi-tier pricing (use this OR simple price, not both)
     * Note: Each tier automatically gets a unique MongoDB ObjectId (_id field)
     * This _id can be used to identify specific tiers in enrollments and payments
     */
    pricingTiers: [
      {
        // MongoDB automatically adds _id field to each subdocument
        name: {
          type: String,
          required: [true, "Tier name is required"],
          trim: true,
          maxlength: [100, "Tier name cannot exceed 100 characters"],
        },
        price: {
          type: Number,
          required: [true, "Tier price is required"],
          min: [0, "Tier price cannot be negative"],
        },
        compareAtPrice: {
          type: Number,
          min: [0, "Compare at price cannot be negative"],
        },
        shortDescription: {
          type: String,
          trim: true,
          maxlength: [500, "Short description cannot exceed 500 characters"],
        },
        notes: {
          type: String,
          trim: true,
          maxlength: [1000, "Notes cannot exceed 1000 characters"],
        },
        ticketQuantity: {
          type: Number,
          default: 1,
          min: [1, "Ticket quantity must be at least 1"],
        },
      },
    ],

    /**
     * Available seats/slots (optional)
     */
    availableSeats: {
      type: Number,
      required: false,
      min: [0, "Available seats cannot be negative"],
    },

    /**
     * Number of tickets sold
     */
    ticketsSold: {
      type: Number,
      required: false,
      default: 0,
      min: [0, "Tickets sold cannot be negative"],
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
     * Whether this event has seat arrangements enabled
     */
    hasSeatArrangement: {
      type: Boolean,
      default: false,
    },

    /**
     * Reference to seat arrangement (if enabled)
     */
    seatArrangementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeatArrangement",
      default: null,
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
 * Index for improving query performance
 */
// eventSchema.index({ isDeleted: 1, isLive: 1 });
// eventSchema.index({ category: 1, isDeleted: 1 });
// eventSchema.index({ startDate: 1, endDate: 1 });
// eventSchema.index({ mode: 1, city: 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ bookingStartDate: 1, endDate: 1 });

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
 * Pre-save middleware to auto-update isLive status, auto-fill booking dates, and validate pricing
 */
eventSchema.pre("save", function (next) {
  const now = new Date();

  // Auto-fill booking dates if not provided (only for new documents)
  if (this.isNew) {
    // If bookingStartDate not provided, set it to now
    if (!this.bookingStartDate) {
      this.bookingStartDate = now;
      console.log(`[Event] Auto-filled bookingStartDate to current time for event: ${this.name}`);
    }

    // If bookingEndDate not provided, set it to event start date (booking closes when event starts)
    if (!this.bookingEndDate && this.startDate) {
      this.bookingEndDate = this.startDate;
      console.log(`[Event] Auto-filled bookingEndDate to event start date for event: ${this.name}`);
    }
  }

  // Update isLive: true from bookingStartDate until eventEndDate
  if (this.bookingStartDate && this.endDate) {
    if (now >= this.bookingStartDate && now <= this.endDate) {
      this.isLive = true;
    } else if (now > this.endDate) {
      this.isLive = false;
    }
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
  // Skip validation when soft deleting to avoid issues with events
  // that may not have the new booking date fields yet
  return this.save({ validateBeforeSave: false });
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

  // Check if event has ended
  if (this.endDate <= now && this.isLive) {
    this.isLive = false;
    return this.save();
  }

  // Check if event is within live window (bookingStart to eventEnd)
  if (
    this.bookingStartDate &&
    this.bookingStartDate <= now &&
    now <= this.endDate &&
    !this.isLive
  ) {
    this.isLive = true;
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
