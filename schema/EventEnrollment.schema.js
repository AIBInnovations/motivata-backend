/**
 * @fileoverview Event Enrollment schema definition
 * @module schema/EventEnrollment
 */

import mongoose from 'mongoose';

const eventEnrollmentSchema = new mongoose.Schema({
  /**
   * Reference to Payment
   */
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Payment ID is required']
  },

  /**
   * Razorpay order ID (denormalized for quick access)
   */
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
    trim: true
  },

  /**
   * User who enrolled
   */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  /**
   * Event enrolled in
   */
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required']
  },

  /**
   * Total number of tickets purchased in this enrollment
   */
  ticketCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },

  /**
   * Tickets - Map of phone numbers to ticket details
   * Each key is a phone number, value contains ticket-specific data
   * Example: {
   *   "1234567890": {
   *     status: "ACTIVE",
   *     cancelledAt: null,
   *     cancellationReason: null,
   *     isTicketScanned: false,
   *     ticketScannedAt: null,
   *     ticketScannedBy: null
   *   }
   * }
   */
  tickets: {
    type: Map,
    of: {
      status: {
        type: String,
        required: true,
        enum: {
          values: ['ACTIVE', 'CANCELLED', 'REFUNDED'],
          message: '{VALUE} is not a valid ticket status'
        },
        default: 'ACTIVE'
      },
      cancelledAt: {
        type: Date,
        default: null
      },
      cancellationReason: {
        type: String,
        trim: true,
        default: null
      },
      isTicketScanned: {
        type: Boolean,
        default: false
      },
      ticketScannedAt: {
        type: Date,
        default: null
      },
      ticketScannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
      }
    },
    required: true,
    default: new Map()
  }
}, {
  timestamps: true
});

/**
 * Indexes for improving query performance
 */
eventEnrollmentSchema.index({ paymentId: 1 });
eventEnrollmentSchema.index({ orderId: 1 });
eventEnrollmentSchema.index({ userId: 1, status: 1 });
eventEnrollmentSchema.index({ eventId: 1, status: 1 });
eventEnrollmentSchema.index({ createdAt: -1 });

/**
 * Compound index to ensure one enrollment per user per event
 */
eventEnrollmentSchema.index({ userId: 1, eventId: 1 }, { unique: true });

const EventEnrollment = mongoose.model('EventEnrollment', eventEnrollmentSchema);

export default EventEnrollment;
