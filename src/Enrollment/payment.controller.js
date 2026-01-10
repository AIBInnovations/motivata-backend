/**
 * @fileoverview Payment controller with pluggable payment gateway support
 * @module controllers/payment
 */

import Payment from '../../schema/Payment.schema.js';
import Coupon from '../../schema/Coupon.schema.js';
import Event from '../../schema/Event.schema.js';
import responseUtil from '../../utils/response.util.js';
import PaymentServiceFactory from '../../services/payment/PaymentServiceFactory.js';
import { reserveSeats, releaseSeatReservation } from '../SeatArrangement/seatArrangement.controller.js';

/**
 * Get payment service instance
 */
const paymentService = PaymentServiceFactory.getPaymentService();

/**
 * Create a new payment order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with order details
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const { type, eventId, sessionId, amount, couponCode, metadata } = req.body;
    const userId = req.user.id;

    let finalAmount = amount;
    let discountAmount = 0;
    let appliedCouponCode = null;

    // Validate event if type is EVENT
    if (type === 'EVENT' && eventId) {
      const event = await Event.findById(eventId);
      if (!event) {
        return responseUtil.notFound(res, 'Event not found');
      }

      if (!event.isLive) {
        return responseUtil.badRequest(res, 'Event is not available for booking');
      }

      const now = new Date();

      // Check booking window
      if (now < event.bookingStartDate) {
        return responseUtil.badRequest(
          res,
          `Booking opens on ${event.bookingStartDate.toLocaleString()}`
        );
      }

      if (now > event.bookingEndDate) {
        return responseUtil.badRequest(res, 'Booking has closed for this event');
      }

      // Check available seats only if the event tracks them
      if (event.availableSeats != null && event.availableSeats <= 0) {
        return responseUtil.badRequest(res, 'No seats available for this event');
      }

      // If event has seat arrangement, validate seat selection
      if (event.hasSeatArrangement) {
        console.log('[PAYMENT:SEAT] Event has seat arrangement, validating selection', {
          eventId,
          hasSeatArrangement: event.hasSeatArrangement
        });

        const { selectedSeats } = metadata || {};

        if (!selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
          console.log('[PAYMENT:SEAT] Validation FAILED - No seats selected', {
            eventId,
            selectedSeats: selectedSeats || 'undefined'
          });
          return responseUtil.badRequest(res, 'Seat selection is required for this event');
        }

        // Validate count matches total tickets
        const totalTickets = metadata.totalTickets || 1;
        if (selectedSeats.length !== totalTickets) {
          console.log('[PAYMENT:SEAT] Validation FAILED - Seat count mismatch', {
            eventId,
            selectedSeatsCount: selectedSeats.length,
            expectedCount: totalTickets
          });
          return responseUtil.badRequest(res, `Must select ${totalTickets} seat(s)`);
        }

        console.log('[PAYMENT:SEAT] Validation PASSED', {
          eventId,
          selectedSeats: selectedSeats.map(s => ({ seatLabel: s.seatLabel, phone: s.phone })),
          totalTickets
        });
      }
    }

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (!coupon) {
        return responseUtil.notFound(res, 'Invalid coupon code');
      }

      // Validate coupon
      const now = new Date();
      if (!coupon.isActive) {
        return responseUtil.badRequest(res, 'Coupon is not active');
      }

      if (now < coupon.validFrom || now > coupon.validUntil) {
        return responseUtil.badRequest(res, 'Coupon is not valid at this time');
      }

      if (coupon.maxUsageLimit !== null && coupon.usageCount >= coupon.maxUsageLimit) {
        return responseUtil.badRequest(res, 'Coupon usage limit reached');
      }

      if (amount < coupon.minPurchaseAmount) {
        return responseUtil.badRequest(
          res,
          `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`
        );
      }

      // Check user-specific usage
      const userUsageCount = await Payment.countDocuments({
        userId,
        couponCode: coupon.code,
        status: 'SUCCESS'
      });

      if (userUsageCount >= coupon.maxUsagePerUser) {
        return responseUtil.badRequest(
          res,
          'You have reached the maximum usage limit for this coupon'
        );
      }

      // Calculate discount
      discountAmount = (amount * coupon.discountPercent) / 100;
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      finalAmount = amount - discountAmount;
      appliedCouponCode = coupon.code;
    }

    // Ensure final amount is not negative
    if (finalAmount < 0) {
      finalAmount = 0;
    }

    // Create order using payment service
    const gatewayOrder = await paymentService.createOrder({
      amount: finalAmount,
      currency: 'INR',
      receipt: `order_${Date.now()}_${userId}`,
      notes: {
        userId,
        type,
        eventId: eventId || '',
        sessionId: sessionId || ''
      }
    });

    // Create payment record
    const payment = new Payment({
      orderId: gatewayOrder.id,
      userId,
      type,
      eventId: eventId || null,
      sessionId: sessionId || null,
      amount,
      couponCode: appliedCouponCode,
      discountAmount,
      finalAmount,
      status: 'PENDING',
      metadata: metadata || {}
    });

    await payment.save();

    // Reserve seats if event has seat arrangement
    if (type === 'EVENT' && eventId) {
      const event = await Event.findById(eventId).select('hasSeatArrangement');
      if (event?.hasSeatArrangement && metadata?.selectedSeats) {
        console.log('[PAYMENT:SEAT] Starting seat reservation', {
          eventId,
          orderId: gatewayOrder.id,
          userId,
          seatCount: metadata.selectedSeats.length,
          seats: metadata.selectedSeats.map(s => s.seatLabel)
        });

        try {
          const reservationStart = Date.now();
          await reserveSeats({
            eventId,
            selectedSeats: metadata.selectedSeats,
            userId,
            orderId: gatewayOrder.id
          });
          const reservationDuration = Date.now() - reservationStart;

          console.log('[PAYMENT:SEAT] Seat reservation SUCCESS', {
            orderId: gatewayOrder.id,
            eventId,
            reservedSeats: metadata.selectedSeats.map(s => s.seatLabel),
            durationMs: reservationDuration
          });
        } catch (seatError) {
          // Seat reservation failed - rollback payment
          console.error('[PAYMENT:SEAT] Seat reservation FAILED', {
            orderId: gatewayOrder.id,
            eventId,
            error: seatError.message,
            requestedSeats: metadata.selectedSeats.map(s => s.seatLabel)
          });

          await Payment.deleteOne({ _id: payment._id });
          console.log('[PAYMENT:SEAT] Payment record rolled back', {
            paymentId: payment._id,
            orderId: gatewayOrder.id
          });

          return responseUtil.badRequest(res, seatError.message || 'Selected seats are no longer available');
        }
      }
    }

    // Get gateway config for client
    const gatewayConfig = paymentService.getGatewayConfig();

    return responseUtil.created(res, 'Payment order created successfully', {
      order: {
        orderId: gatewayOrder.id,
        amount: finalAmount,
        currency: 'INR',
        originalAmount: amount,
        discountAmount,
        couponApplied: !!appliedCouponCode
      },
      gateway: {
        name: paymentService.getGatewayName(),
        keyId: gatewayConfig.keyId,
        config: gatewayConfig
      }
    });
  } catch (error) {
    console.error('Create payment order error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create payment order', error.message);
  }
};

/**
 * Verify payment signature
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming payment verification
 */
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const userId = req.user.id;

    // Find payment record
    const payment = await Payment.findOne({ orderId, userId });

    if (!payment) {
      return responseUtil.notFound(res, 'Payment not found');
    }

    if (payment.status === 'SUCCESS') {
      return responseUtil.badRequest(res, 'Payment already verified');
    }

    // Verify payment using payment service
    const isValid = await paymentService.verifyPayment({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      payment.status = 'FAILED';
      payment.failureReason = 'Invalid payment signature';
      await payment.save();

      return responseUtil.badRequest(res, 'Invalid payment signature');
    }

    // Update payment status
    payment.paymentId = paymentId;
    payment.signature = signature;
    payment.status = 'SUCCESS';
    payment.purchaseDateTime = new Date();
    await payment.save();

    // Increment coupon usage if coupon was used
    if (payment.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: payment.couponCode },
        { $inc: { usageCount: 1 } }
      );
    }

    // Note: Event ticket counts (ticketsSold, availableSeats) are updated
    // when enrollment is created, not during payment verification

    return responseUtil.success(res, 'Payment verified successfully', {
      payment: {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.finalAmount,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return responseUtil.internalError(res, 'Failed to verify payment', error.message);
  }
};

/**
 * Get user's payment history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with user's payments
 */
export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type
    } = req.query;

    // Build query
    const query = { userId };

    if (status) query.status = status;
    if (type) query.type = type;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [payments, totalCount] = await Promise.all([
      Payment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('eventId', 'name startDate endDate bookingStartDate bookingEndDate mode city')
        .populate('sessionId', 'name startDate endDate'),
      Payment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Payments retrieved successfully', {
      payments,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve payments', error.message);
  }
};

/**
 * Get payment by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with payment details
 */
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.userType === 'admin';

    const query = isAdmin ? { _id: id } : { _id: id, userId };

    const payment = await Payment.findOne(query)
      .populate('userId', 'name email phone')
      .populate('eventId', 'name startDate endDate bookingStartDate bookingEndDate mode city price')
      .populate('sessionId', 'name startDate endDate');

    if (!payment) {
      return responseUtil.notFound(res, 'Payment not found');
    }

    return responseUtil.success(res, 'Payment retrieved successfully', { payment });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve payment', error.message);
  }
};

/**
 * Get all payments with filters (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated payments
 */
export const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      eventId,
      sessionId,
      paymentMethod
    } = req.query;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (eventId) query.eventId = eventId;
    if (sessionId) query.sessionId = sessionId;

    // Filter by payment method
    if (paymentMethod === 'CASH') {
      query['metadata.paymentMethod'] = 'CASH';
    } else if (paymentMethod === 'RAZORPAY') {
      query['metadata.paymentMethod'] = { $ne: 'CASH' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [payments, totalCount] = await Promise.all([
      Payment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email phone')
        .populate('eventId', 'name startDate endDate bookingStartDate bookingEndDate mode city')
        .populate('sessionId', 'name startDate endDate'),
      Payment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Calculate summary statistics
    const stats = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
          }
        }
      }
    ]);

    return responseUtil.success(res, 'Payments retrieved successfully', {
      payments,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      },
      statistics: stats.length > 0 ? stats[0] : {
        totalRevenue: 0,
        totalDiscount: 0,
        successfulPayments: 0,
        failedPayments: 0
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve payments', error.message);
  }
};

/**
 * Handle payment failure
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming failure recording
 */
export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findOne({ orderId, userId });

    if (!payment) {
      return responseUtil.notFound(res, 'Payment not found');
    }

    payment.status = 'FAILED';
    payment.failureReason = reason || 'Payment failed';
    await payment.save();

    // Release seat reservations if event has seat arrangement
    if (payment.eventId && payment.metadata?.selectedSeats) {
      console.log('[PAYMENT:SEAT] Payment failed, checking for seat release', {
        orderId: payment.orderId,
        eventId: payment.eventId,
        selectedSeats: payment.metadata.selectedSeats.map(s => s.seatLabel)
      });

      const event = await Event.findById(payment.eventId).select('hasSeatArrangement');
      if (event?.hasSeatArrangement) {
        try {
          const releaseStart = Date.now();
          await releaseSeatReservation({ orderId: payment.orderId });
          const releaseDuration = Date.now() - releaseStart;

          console.log('[PAYMENT:SEAT] Seat release SUCCESS (payment failed)', {
            orderId: payment.orderId,
            eventId: payment.eventId,
            releasedSeats: payment.metadata.selectedSeats.map(s => s.seatLabel),
            durationMs: releaseDuration
          });
        } catch (seatError) {
          console.error('[PAYMENT:SEAT] Seat release FAILED (payment failed)', {
            orderId: payment.orderId,
            eventId: payment.eventId,
            error: seatError.message,
            note: 'Seats will be released by cleanup job'
          });
          // Continue anyway - seats will be released by cleanup job
        }
      }
    }

    return responseUtil.success(res, 'Payment failure recorded');
  } catch (error) {
    console.error('Handle payment failure error:', error);
    return responseUtil.internalError(res, 'Failed to record payment failure', error.message);
  }
};

export default {
  createPaymentOrder,
  verifyPayment,
  getUserPayments,
  getPaymentById,
  getAllPayments,
  handlePaymentFailure
};
