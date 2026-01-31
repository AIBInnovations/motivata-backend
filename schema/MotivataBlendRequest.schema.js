/**
 * @fileoverview MotivataBlendRequest schema for tracking Motivata Blend weekly session registration requests
 * @module schema/MotivataBlendRequest
 *
 * Flow: User submits form → Admin reviews → Admin approves/rejects
 */

import mongoose from 'mongoose';

const motivataBlendRequestSchema = new mongoose.Schema(
  {
    /**
     * Phone number (normalized to last 10 digits)
     */
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: 'Phone must be exactly 10 digits (normalized)'
      },
      index: true
    },

    /**
     * User's name from form submission
     */
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      set: (value) => {
        if (!value) return value;
        return value
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    },

    /**
     * User's email address
     */
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: 'Email must be valid'
      }
    },

    /**
     * Request status
     */
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },

    /**
     * When the request was submitted
     */
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    /**
     * Admin who reviewed this request
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },

    /**
     * When the request was reviewed
     */
    reviewedAt: {
      type: Date,
      default: null
    },

    /**
     * Admin's internal notes
     */
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: null
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'motivata_blend_requests'
  }
);

// Indexes for efficient querying
motivataBlendRequestSchema.index({ phone: 1, submittedAt: -1 });
motivataBlendRequestSchema.index({ email: 1, submittedAt: -1 });
motivataBlendRequestSchema.index({ status: 1, submittedAt: -1 });
motivataBlendRequestSchema.index({ isDeleted: 1, status: 1 });

// Static method to check for duplicate requests within 7 days
motivataBlendRequestSchema.statics.checkDuplicateRequest = async function(phone, email) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const duplicate = await this.findOne({
    $or: [
      { phone, submittedAt: { $gte: sevenDaysAgo } },
      { email, submittedAt: { $gte: sevenDaysAgo } }
    ],
    isDeleted: false
  });

  return duplicate;
};

const MotivataBlendRequest = mongoose.model('MotivataBlendRequest', motivataBlendRequestSchema);

export default MotivataBlendRequest;
