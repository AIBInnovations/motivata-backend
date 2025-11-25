/**
 * @fileoverview Payment schema definition for Razorpay integration
 * @module schema/Payment
 */

import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  /**
   * Razorpay order ID
   */
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true,
    trim: true
  },

  /**
   * Razorpay payment ID (after successful payment)
   */
  paymentId: {
    type: String,
    trim: true,
    default: null
  },

  /**
   * Razorpay signature for verification
   */
  signature: {
    type: String,
    trim: true,
    default: null
  },

  /**
   * User who made the payment (optional for guest checkout)
   */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },

  /**
   * Payment type
   */
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: {
      values: ['EVENT', 'SESSION', 'OTHER', 'PRODUCT'],
      message: '{VALUE} is not a valid payment type'
    }
  },

  /**
   * Reference to Event (if type is EVENT)
   */
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },

  /**
   * Reference to Session (if type is SESSION)
   */
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },

  /**
   * Original amount before discount
   */
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },

  /**
   * Coupon code used (if any)
   */
  couponCode: {
    type: String,
    uppercase: true,
    trim: true,
    default: null
  },

  /**
   * Discount amount applied
   */
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },

  /**
   * Final amount after discount (amount paid)
   */
  finalAmount: {
    type: Number,
    required: [true, 'Final amount is required'],
    min: [0, 'Final amount cannot be negative']
  },

  /**
   * Payment status
   */
  status: {
    type: String,
    required: true,
    enum: {
      values: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'PENDING'
  },

  /**
   * Date and time of purchase
   */
  purchaseDateTime: {
    type: Date,
    default: Date.now
  },

  /**
   * Additional metadata
   */
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  /**
   * Failure reason (if payment failed)
   */
  failureReason: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true
});

/**
 * Indexes for improving query performance
 */
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ type: 1, status: 1 });
paymentSchema.index({ eventId: 1, status: 1 });
paymentSchema.index({ sessionId: 1, status: 1 });
paymentSchema.index({ purchaseDateTime: -1 });
paymentSchema.index({ createdAt: -1 });

/**
 * Compound index for user and coupon usage tracking
 */
paymentSchema.index({ userId: 1, couponCode: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
