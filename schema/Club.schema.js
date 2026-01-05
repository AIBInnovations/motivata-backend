/**
 * @fileoverview Club schema for Connect social clubs feature
 * @module schema/Club
 *
 * Clubs are public communities where users can share posts on specific topics.
 * All clubs are public - no privacy restrictions or access control.
 */

import mongoose from "mongoose";

const clubSchema = new mongoose.Schema(
  {
    /**
     * Club name/title
     */
    name: {
      type: String,
      required: [true, "Club name is required"],
      trim: true,
      minlength: [2, "Club name must be at least 2 characters"],
      maxlength: [100, "Club name cannot exceed 100 characters"],
      index: true,
    },

    /**
     * Club description
     */
    description: {
      type: String,
      required: [true, "Club description is required"],
      trim: true,
      maxlength: [1000, "Club description cannot exceed 1000 characters"],
    },

    /**
     * Club thumbnail image URL
     */
    thumbnail: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid thumbnail URL"],
      default: null,
    },

    /**
     * Member count (denormalized for performance)
     */
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Post count (denormalized for performance)
     */
    postCount: {
      type: Number,
      default: 0,
      min: 0,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for performance
 */
clubSchema.index({ name: 1, isDeleted: 1 });
clubSchema.index({ createdAt: -1 });
clubSchema.index({ memberCount: -1 });
clubSchema.index({ postCount: -1 });

/**
 * Pre-query middleware to exclude soft deleted clubs
 */
clubSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to find deleted clubs
 */
clubSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt"
  );
};

/**
 * Instance method for soft delete
 */
clubSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Instance method to restore soft deleted club
 */
clubSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

/**
 * Static method for permanent delete
 */
clubSchema.statics.permanentDelete = function (id) {
  return this.findByIdAndDelete(id);
};

/**
 * Instance method to increment member count
 */
clubSchema.methods.incrementMemberCount = function () {
  this.memberCount = (this.memberCount || 0) + 1;
  return this.save();
};

/**
 * Instance method to decrement member count
 */
clubSchema.methods.decrementMemberCount = function () {
  if (this.memberCount > 0) {
    this.memberCount -= 1;
  }
  return this.save();
};

/**
 * Instance method to increment post count
 */
clubSchema.methods.incrementPostCount = function () {
  this.postCount = (this.postCount || 0) + 1;
  return this.save();
};

/**
 * Instance method to decrement post count
 */
clubSchema.methods.decrementPostCount = function () {
  if (this.postCount > 0) {
    this.postCount -= 1;
  }
  return this.save();
};

const Club = mongoose.model("Club", clubSchema);

export default Club;
