/**
 * @fileoverview EventRequest schema for tracking invite-only event registration requests
 * @module schema/EventRequest
 *
 * Flow: User submits form → Admin reviews → Admin approves/rejects
 * Only applies to events with audience === 'INVITE_ONLY'.
 */

import mongoose from 'mongoose';

const eventRequestSchema = new mongoose.Schema(
  {
    /**
     * The event this request is for.
     * Required so that duplicate checks, filters, and stats are all scoped per-event.
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true
    },

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
     * User's email address (optional — validated only when provided)
     */
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
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
    collection: 'event_requests'
  }
);

// Compound indexes for efficient per-event querying
eventRequestSchema.index({ eventId: 1, phone: 1, submittedAt: -1 });
eventRequestSchema.index({ eventId: 1, email: 1, submittedAt: -1 });
eventRequestSchema.index({ eventId: 1, status: 1, submittedAt: -1 });
eventRequestSchema.index({ eventId: 1, isDeleted: 1, status: 1 });
eventRequestSchema.index({ status: 1, submittedAt: -1 });
eventRequestSchema.index({ isDeleted: 1, status: 1 });

/**
 * Check for a duplicate request within 7 days, scoped to the same event.
 * Same phone (always) OR same email (when provided) for the same eventId
 * within the window counts as a duplicate.
 *
 * @param {string} phone - Normalized 10-digit phone
 * @param {string|null} email - Lowercase email, or null when not provided
 * @param {ObjectId|string} eventId - The event being requested
 * @returns {Promise<Document|null>} Existing request document, or null
 */
eventRequestSchema.statics.checkDuplicateRequest = async function (phone, email, eventId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const orConditions = [{ phone, submittedAt: { $gte: sevenDaysAgo } }];
  if (email) {
    orConditions.push({ email, submittedAt: { $gte: sevenDaysAgo } });
  }

  const duplicate = await this.findOne({
    eventId,
    $or: orConditions,
    isDeleted: false
  });

  return duplicate;
};

const EventRequest = mongoose.model('EventRequest', eventRequestSchema);

export default EventRequest;
