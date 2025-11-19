/**
 * @fileoverview Payment controller with pluggable payment gateway support
 * @module controllers/payment
 */

import Payment from '../../schema/Payment.schema.js';
import Coupon from '../../schema/Coupon.schema.js';
import Event from '../../schema/Event.schema.js';
import responseUtil from '../../utils/response.util.js';
import PaymentServiceFactory from '../../services/payment/PaymentServiceFactory.js';

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

      if (event.availableSeats <= 0) {
        return responseUtil.badRequest(res, 'No seats available for this event');
      }

      // Check if event has already started or ended
      const now = new Date();
      if (now > event.endDate) {
        return responseUtil.badRequest(res, 'Event has ended');
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

    // Decrement available seats if event payment
    if (payment.type === 'EVENT' && payment.eventId) {
      await Event.findByIdAndUpdate(
        payment.eventId,
        { $inc: { availableSeats: -1 } }
      );
    }

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
        .populate('eventId', 'name startDate endDate mode city')
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
      .populate('eventId', 'name startDate endDate mode city price')
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
      sessionId
    } = req.query;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (eventId) query.eventId = eventId;
    if (sessionId) query.sessionId = sessionId;

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
        .populate('eventId', 'name startDate endDate mode city')
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
