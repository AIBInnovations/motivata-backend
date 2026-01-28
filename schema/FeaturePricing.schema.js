/**
 * @fileoverview FeaturePricing schema
 * Defines configurable pricing for individual features and feature bundles
 * @module schema/FeaturePricing
 */

import mongoose from 'mongoose';

const featurePricingSchema = new mongoose.Schema(
  {
    /**
     * Feature identifier (SOS, CONNECT, CHALLENGE, or bundle keys like SOS_CONNECT)
     */
    featureKey: {
      type: String,
      required: [true, 'Feature key is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [50, 'Feature key cannot exceed 50 characters']
    },

    /**
     * Display name
     */
    name: {
      type: String,
      required: [true, 'Feature pricing name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters']
    },

    /**
     * Description
     */
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: ''
    },

    /**
     * Price in INR
     */
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number']
    },

    /**
     * Strike-through price for display
     */
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare at price must be a positive number'],
      default: null,
      validate: {
        validator: function (value) {
          return !value || value >= this.price;
        },
        message: 'Compare at price must be greater than or equal to price'
      }
    },

    /**
     * Duration in days (null or 0 = lifetime)
     */
    durationInDays: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          return value === null || value === 0 || value > 0;
        },
        message: 'Duration must be null/0 (lifetime) or a positive number'
      }
    },

    /**
     * Flag to explicitly mark lifetime access
     */
    isLifetime: {
      type: Boolean,
      default: false
    },

    /**
     * Is this a bundle (e.g., SOS + Connect)?
     */
    isBundle: {
      type: Boolean,
      default: false
    },

    /**
     * For bundles: which features are included
     */
    includedFeatures: [{
      type: String,
      uppercase: true,
      trim: true,
      enum: {
        values: ['SOS', 'CONNECT', 'CHALLENGE'],
        message: '{VALUE} is not a valid feature'
      }
    }],

    /**
     * Perks and benefits
     */
    perks: [{
      type: String,
      trim: true,
      maxlength: [500, 'Each perk cannot exceed 500 characters']
    }],

    /**
     * Metadata for custom features
     */
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * Display ordering
     */
    displayOrder: {
      type: Number,
      default: 0
    },

    /**
     * Featured flag for highlighting
     */
    isFeatured: {
      type: Boolean,
      default: false
    },

    /**
     * Active flag
     */
    isActive: {
      type: Boolean,
      default: true
    },

    /**
     * Maximum purchases (null = unlimited)
     */
    maxPurchases: {
      type: Number,
      min: [0, 'Max purchases must be a positive number'],
      default: null
    },

    /**
     * Current purchase count
     */
    currentPurchases: {
      type: Number,
      default: 0,
      min: [0, 'Current purchases cannot be negative']
    },

    /**
     * Audit fields
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    /**
     * Soft delete
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
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

// Pre-save hook to automatically set isLifetime flag
featurePricingSchema.pre('save', function (next) {
  this.isLifetime = this.durationInDays === null || this.durationInDays === 0;
  next();
});

// Indexes
featurePricingSchema.index({ isDeleted: 1, isActive: 1 });
featurePricingSchema.index({ displayOrder: 1 });
featurePricingSchema.index({ isFeatured: 1 });
featurePricingSchema.index({ isBundle: 1 });
featurePricingSchema.index({ featureKey: 1, isDeleted: 1 });

/**
 * Virtual for availability check
 */
featurePricingSchema.virtual('isAvailable').get(function () {
  if (!this.isActive || this.isDeleted) {
    return false;
  }
  if (this.maxPurchases !== null && this.currentPurchases >= this.maxPurchases) {
    return false;
  }
  return true;
});

/**
 * Method to check if pricing can be purchased
 */
featurePricingSchema.methods.canBePurchased = function () {
  if (!this.isActive || this.isDeleted) {
    return { canPurchase: false, reason: 'Pricing is not available' };
  }
  if (this.maxPurchases !== null && this.currentPurchases >= this.maxPurchases) {
    return { canPurchase: false, reason: 'Purchase limit reached' };
  }
  return { canPurchase: true };
};

/**
 * Method to increment purchase count
 */
featurePricingSchema.methods.incrementPurchaseCount = async function () {
  this.currentPurchases += 1;
  await this.save();
};

/**
 * Method to decrement purchase count (on refund)
 */
featurePricingSchema.methods.decrementPurchaseCount = async function () {
  if (this.currentPurchases > 0) {
    this.currentPurchases -= 1;
    await this.save();
  }
};

/**
 * Soft delete method
 */
featurePricingSchema.methods.softDelete = async function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

/**
 * Restore method
 */
featurePricingSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
};

/**
 * Static method to find active pricing options
 */
featurePricingSchema.statics.findActive = function (includeInactive = false) {
  const query = { isDeleted: false };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).sort({ displayOrder: 1, createdAt: -1 });
};

/**
 * Static method to find featured pricing
 */
featurePricingSchema.statics.findFeatured = function () {
  return this.find({ isDeleted: false, isActive: true, isFeatured: true })
    .sort({ displayOrder: 1, createdAt: -1 });
};

/**
 * Static method to find pricing for specific features
 */
featurePricingSchema.statics.findByFeatureKey = function (featureKey) {
  return this.findOne({
    featureKey: featureKey.toUpperCase(),
    isDeleted: false,
    isActive: true
  });
};

/**
 * Static method to find bundles containing specific features
 */
featurePricingSchema.statics.findBundlesForFeatures = function (featureKeys) {
  const upperKeys = featureKeys.map(k => k.toUpperCase());
  return this.find({
    isBundle: true,
    isDeleted: false,
    isActive: true,
    includedFeatures: { $all: upperKeys }
  }).sort({ price: 1 });
};

// Ensure virtual fields are serialized
featurePricingSchema.set('toJSON', { virtuals: true });
featurePricingSchema.set('toObject', { virtuals: true });

const FeaturePricing = mongoose.model('FeaturePricing', featurePricingSchema);

export default FeaturePricing;
