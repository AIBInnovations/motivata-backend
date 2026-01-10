/**
 * @fileoverview FeatureAccess schema
 * Controls feature access based on membership requirements
 * Allows admins to toggle membership requirements for features
 * @module schema/FeatureAccess
 */

import mongoose from 'mongoose';

const featureAccessSchema = new mongoose.Schema(
  {
    featureKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    featureName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    requiresMembership: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
featureAccessSchema.index({ featureKey: 1 });

const FeatureAccess = mongoose.model('FeatureAccess', featureAccessSchema);

export default FeatureAccess;
