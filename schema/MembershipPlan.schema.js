/**
 * @fileoverview MembershipPlan schema
 * Defines configurable membership plans with pricing and perks
 * @module schema/MembershipPlan
 */

import mongoose from 'mongoose';
import { nowIST } from '../utils/timezone.util.js';

const membershipPlanSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, 'Membership plan name is required'],
      trim: true,
      maxlength: [200, 'Plan name cannot exceed 200 characters']
    },

    description: {
      type: String,
      required: [true, 'Membership plan description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },

    // Pricing
    price: {
      type: Number,
      required: [true, 'Membership price is required'],
      min: [0, 'Price must be a positive number']
    },

    compareAtPrice: {
      type: Number,
      min: [0, 'Compare at price must be a positive number'],
      validate: {
        validator: function (value) {
          return !value || value >= this.price;
        },
        message: 'Compare at price must be greater than or equal to price'
      }
    },

    // Duration
    durationInDays: {
      type: Number,
      required: [true, 'Membership duration is required'],
      min: [1, 'Duration must be at least 1 day']
    },

    // Perks and Benefits
    perks: [
      {
        type: String,
        trim: true,
        maxlength: [500, 'Each perk cannot exceed 500 characters']
      }
    ],

    // Metadata for custom features/perks
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Display and Ordering
    displayOrder: {
      type: Number,
      default: 0
    },

    isFeatured: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // Availability
    maxPurchases: {
      type: Number,
      min: [0, 'Max purchases must be a positive number'],
      default: null // null = unlimited
    },

    currentPurchases: {
      type: Number,
      default: 0,
      min: [0, 'Current purchases cannot be negative']
    },

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
membershipPlanSchema.index({ isDeleted: 1, isActive: 1 });
membershipPlanSchema.index({ displayOrder: 1 });
membershipPlanSchema.index({ isFeatured: 1 });

// Virtual for availability check
membershipPlanSchema.virtual('isAvailable').get(function () {
  if (!this.isActive || this.isDeleted) {
    return false;
  }
  if (this.maxPurchases !== null && this.currentPurchases >= this.maxPurchases) {
    return false;
  }
  return true;
});

// Method to check if plan can be purchased
membershipPlanSchema.methods.canBePurchased = function () {
  if (!this.isActive || this.isDeleted) {
    return { canPurchase: false, reason: 'Plan is not available' };
  }
  if (this.maxPurchases !== null && this.currentPurchases >= this.maxPurchases) {
    return { canPurchase: false, reason: 'Purchase limit reached' };
  }
  return { canPurchase: true };
};

// Method to increment purchase count
membershipPlanSchema.methods.incrementPurchaseCount = async function () {
  this.currentPurchases += 1;
  await this.save();
};

// Method to decrement purchase count (on refund)
membershipPlanSchema.methods.decrementPurchaseCount = async function () {
  if (this.currentPurchases > 0) {
    this.currentPurchases -= 1;
    await this.save();
  }
};

// Soft delete method
membershipPlanSchema.methods.softDelete = async function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = nowIST();
  this.deletedBy = deletedBy;
  await this.save();
};

// Restore method
membershipPlanSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
};

// Static method to find active plans
membershipPlanSchema.statics.findActive = function (includeInactive = false) {
  const query = { isDeleted: false };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).sort({ displayOrder: 1, createdAt: -1 });
};

// Static method to find featured plans
membershipPlanSchema.statics.findFeatured = function () {
  return this.find({ isDeleted: false, isActive: true, isFeatured: true })
    .sort({ displayOrder: 1, createdAt: -1 });
};

// Ensure virtual fields are serialized
membershipPlanSchema.set('toJSON', { virtuals: true });
membershipPlanSchema.set('toObject', { virtuals: true });

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);

export default MembershipPlan;
