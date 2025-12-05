/**
 * @fileoverview SOS Program schema for Generic SOS (1D) and Intensive SOS (7D/15D/30D) programs
 * @module schemas/SOSProgram
 */

import mongoose from "mongoose";

const sosProgramSchema = new mongoose.Schema(
  {
    /**
     * Program title
     */
    title: {
      type: String,
      required: [true, "Program title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    /**
     * Program type - Generic SOS (GSOS) or Intensive SOS (ISOS)
     */
    type: {
      type: String,
      required: [true, "Program type is required"],
      enum: {
        values: ["GSOS", "ISOS"],
        message: "{VALUE} is not a valid program type. Use GSOS or ISOS",
      },
    },

    /**
     * Program description
     */
    description: {
      type: String,
      required: [true, "Program description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    /**
     * Duration in days
     * GSOS: 1 day
     * ISOS: 7, 15, or 30 days
     */
    durationDays: {
      type: Number,
      required: [true, "Duration in days is required"],
      min: [1, "Duration must be at least 1 day"],
      max: [30, "Duration cannot exceed 30 days"],
    },

    /**
     * Whether the program is active and visible to users
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Program cover image URL
     */
    imageUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },

    /**
     * Created by (admin)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /**
     * Last updated by (admin)
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
      select: false,
    },

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 */
sosProgramSchema.index({ type: 1, isDeleted: 1 });
sosProgramSchema.index({ isActive: 1, isDeleted: 1 });
sosProgramSchema.index({ createdAt: -1 });

/**
 * Pre-save validation for duration based on type
 */
sosProgramSchema.pre("save", function (next) {
  // GSOS must have exactly 1 day
  if (this.type === "GSOS" && this.durationDays !== 1) {
    return next(new Error("Generic SOS (GSOS) program must have exactly 1 day duration"));
  }

  // ISOS must have 7, 15, or 30 days
  if (this.type === "ISOS" && ![7, 15, 30].includes(this.durationDays)) {
    return next(new Error("Intensive SOS (ISOS) program must be 7, 15, or 30 days"));
  }

  next();
});

/**
 * Pre-query middleware to exclude soft deleted documents
 */
sosProgramSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Instance method for soft delete
 * @param {ObjectId} adminId - ID of admin performing deletion
 * @returns {Promise<SOSProgram>} Updated document
 */
sosProgramSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted program
 * @returns {Promise<SOSProgram>} Restored document
 */
sosProgramSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method to find deleted programs
 * @param {Object} filter - Query filter
 * @returns {Query} Mongoose query
 */
sosProgramSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select("+isDeleted +deletedAt +deletedBy");
};

/**
 * Static method to find active programs
 * @param {Object} filter - Additional filters
 * @returns {Query} Mongoose query
 */
sosProgramSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isActive: true, isDeleted: false });
};

const SOSProgram = mongoose.model("SOSProgram", sosProgramSchema);

export default SOSProgram;
