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
     * PENDING → PAYMENT_SENT (admin approved, payment link sent) → COMPLETED (paid, ticket sent)
     * PENDING → REJECTED
     * APPROVED is a legacy terminal status from before the payment-link flow existed.
     */
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAYMENT_SENT', 'COMPLETED'],
      default: 'PENDING',
      index: true
    },

    /**
     * Razorpay payment link id, set once the invite is approved and a link is sent
     */
    paymentLinkId: {
      type: String,
      default: null
    },

    /**
     * Razorpay payment link short URL sent to the applicant
     */
    paymentUrl: {
      type: String,
      default: null
    },

    /**
     * Custom orderId used to look up the Payment record from the webhook
     */
    orderId: {
      type: String,
      default: null,
      index: true
    },

    /**
     * Amount (INR) the applicant is charged, set on approval
     */
    paymentAmount: {
      type: Number,
      default: null
    },

    /**
     * EventEnrollment created once the payment link is paid
     */
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventEnrollment',
      default: null
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
 * Check for a blocking duplicate request, scoped to the same event.
 * Same phone (always) OR same email (when provided) for the same eventId
 * counts as a duplicate ONLY while that request is still PENDING or already
 * APPROVED. A REJECTED request never blocks a fresh request — the user is
 * allowed to re-apply and the new request goes back to admin as PENDING.
 *
 * @param {string} phone - Normalized 10-digit phone
 * @param {string|null} email - Lowercase email, or null when not provided
 * @param {ObjectId|string} eventId - The event being requested
 * @returns {Promise<Document|null>} Existing request document, or null
 */
eventRequestSchema.statics.checkDuplicateRequest = async function (phone, email, eventId) {
  const orConditions = [{ phone }];
  if (email) {
    orConditions.push({ email });
  }

  const duplicate = await this.findOne({
    eventId,
    $or: orConditions,
    status: { $in: ['PENDING', 'APPROVED', 'PAYMENT_SENT', 'COMPLETED'] },
    isDeleted: false
  });

  return duplicate;
};

const EventRequest = mongoose.model('EventRequest', eventRequestSchema);

export default EventRequest;
