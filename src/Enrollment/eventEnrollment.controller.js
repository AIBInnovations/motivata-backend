/**
 * @fileoverview Event Enrollment controller
 * @module controllers/eventEnrollment
 */

import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import Payment from '../../schema/Payment.schema.js';
import Event from '../../schema/Event.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create enrollment after successful payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with enrollment details
 */
export const createEnrollment = async (req, res) => {
  try {
    const { paymentId, phones } = req.body;
    const userId = req.user.id;

    // Validate phones array
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return responseUtil.badRequest(res, 'Phone numbers array is required and must contain at least one phone number');
    }

    // Verify payment exists and belongs to user
    const payment = await Payment.findOne({
      paymentId,
      userId,
      status: 'SUCCESS',
      type: 'EVENT'
    });

    if (!payment) {
      return responseUtil.notFound(res, 'Valid payment not found');
    }

    if (!payment.eventId) {
      return responseUtil.badRequest(res, 'Payment is not associated with an event');
    }

    // Check if enrollment already exists
    const existingEnrollment = await EventEnrollment.findOne({
      userId,
      eventId: payment.eventId
    });

    if (existingEnrollment) {
      return responseUtil.conflict(res, 'You are already enrolled in this event');
    }

    // Create tickets map from phone numbers
    const ticketsMap = new Map();
    phones.forEach(phone => {
      ticketsMap.set(phone, {
        status: 'ACTIVE',
        cancelledAt: null,
        cancellationReason: null,
        isTicketScanned: false,
        ticketScannedAt: null,
        ticketScannedBy: null
      });
    });

    // Create enrollment with multiple tickets
    const enrollment = new EventEnrollment({
      paymentId: payment._id,
      orderId: payment.orderId,
      userId,
      eventId: payment.eventId,
      ticketCount: phones.length,
      tickets: ticketsMap
    });

    await enrollment.save();

    const populatedEnrollment = await EventEnrollment.findById(enrollment._id)
      .populate('eventId', 'name startDate endDate mode city price')
      .populate('userId', 'name email phone');

    return responseUtil.created(res, 'Enrollment created successfully', {
      enrollment: populatedEnrollment
    });
  } catch (error) {
    console.error('Create enrollment error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'You are already enrolled in this event');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create enrollment', error.message);
  }
};

/**
 * Get user's enrollments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with user's enrollments
 */
export const getUserEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      eventId
    } = req.query;

    // Build query
    const query = { userId };

    if (status) query.status = status;
    if (eventId) query.eventId = eventId;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [enrollments, totalCount] = await Promise.all([
      EventEnrollment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('eventId', 'name description startDate endDate mode city price imageUrls')
        .populate('paymentId', 'orderId amount finalAmount discountAmount'),
      EventEnrollment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Enrollments retrieved successfully', {
      enrollments,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get user enrollments error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve enrollments', error.message);
  }
};

/**
 * Get enrollment by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with enrollment details
 */
export const getEnrollmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.userType === 'admin';

    const query = isAdmin ? { _id: id } : { _id: id, userId };

    const enrollment = await EventEnrollment.findOne(query)
      .populate('eventId', 'name description startDate endDate mode city price imageUrls')
      .populate('userId', 'name email phone')
      .populate('paymentId', 'orderId amount finalAmount discountAmount couponCode');

    if (!enrollment) {
      return responseUtil.notFound(res, 'Enrollment not found');
    }

    return responseUtil.success(res, 'Enrollment retrieved successfully', { enrollment });
  } catch (error) {
    console.error('Get enrollment by ID error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve enrollment', error.message);
  }
};

/**
 * Get event attendees (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with event attendees
 */
export const getEventAttendees = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status
    } = req.query;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    // Build query
    const query = { eventId };
    if (status) query.status = status;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [enrollments, totalCount] = await Promise.all([
      EventEnrollment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email phone')
        .populate('paymentId', 'orderId amount finalAmount couponCode'),
      EventEnrollment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Get enrollment statistics
    const stats = await EventEnrollment.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statistics = {
      total: totalCount,
      active: stats.find(s => s._id === 'ACTIVE')?.count || 0,
      cancelled: stats.find(s => s._id === 'CANCELLED')?.count || 0,
      refunded: stats.find(s => s._id === 'REFUNDED')?.count || 0
    };

    return responseUtil.success(res, 'Event attendees retrieved successfully', {
      event: {
        id: event._id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate
      },
      enrollments,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      },
      statistics
    });
  } catch (error) {
    console.error('Get event attendees error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve event attendees', error.message);
  }
};

/**
 * Get all enrollments (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with all enrollments
 */
export const getAllEnrollments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      eventId
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (eventId) query.eventId = eventId;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [enrollments, totalCount] = await Promise.all([
      EventEnrollment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('eventId', 'name startDate endDate mode city')
        .populate('userId', 'name email phone')
        .populate('paymentId', 'orderId amount finalAmount'),
      EventEnrollment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Enrollments retrieved successfully', {
      enrollments,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get all enrollments error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve enrollments', error.message);
  }
};

/**
 * Cancel enrollment ticket(s)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming cancellation
 */
export const cancelEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, phone, cancelAll } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.userType === 'admin';

    const query = isAdmin ? { _id: id } : { _id: id, userId };

    const enrollment = await EventEnrollment.findOne(query)
      .populate('eventId');

    if (!enrollment) {
      return responseUtil.notFound(res, 'Enrollment not found');
    }

    // Check if event has already started
    const now = new Date();
    if (now >= enrollment.eventId.startDate) {
      return responseUtil.badRequest(res, 'Cannot cancel tickets after event has started');
    }

    let cancelledCount = 0;

    if (cancelAll) {
      // Cancel all active tickets
      for (const [phoneNum, ticket] of enrollment.tickets) {
        if (ticket.status === 'ACTIVE') {
          ticket.status = 'CANCELLED';
          ticket.cancelledAt = new Date();
          ticket.cancellationReason = reason || null;
          enrollment.tickets.set(phoneNum, ticket);
          cancelledCount++;
        }
      }
    } else if (phone) {
      // Cancel specific ticket by phone
      const ticket = enrollment.tickets.get(phone);

      if (!ticket) {
        return responseUtil.notFound(res, `Ticket for phone ${phone} not found`);
      }

      if (ticket.status !== 'ACTIVE') {
        return responseUtil.badRequest(res, `Ticket for phone ${phone} is not active`);
      }

      ticket.status = 'CANCELLED';
      ticket.cancelledAt = new Date();
      ticket.cancellationReason = reason || null;
      enrollment.tickets.set(phone, ticket);
      cancelledCount = 1;
    } else {
      return responseUtil.badRequest(res, 'Either provide phone number to cancel specific ticket or set cancelAll to true');
    }

    await enrollment.save();

    // Increment available seats by number of cancelled tickets
    if (cancelledCount > 0) {
      await Event.findByIdAndUpdate(
        enrollment.eventId._id,
        { $inc: { availableSeats: cancelledCount } }
      );
    }

    return responseUtil.success(res, `${cancelledCount} ticket(s) cancelled successfully`, {
      enrollment,
      cancelledCount
    });
  } catch (error) {
    console.error('Cancel enrollment error:', error);
    return responseUtil.internalError(res, 'Failed to cancel ticket(s)', error.message);
  }
};

/**
 * Check if user is enrolled in an event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with enrollment status
 */
export const checkEnrollmentStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const enrollment = await EventEnrollment.findOne({
      userId,
      eventId
    });

    // Check if any ticket is active
    let hasActiveTicket = false;
    let activeTicketCount = 0;

    if (enrollment && enrollment.tickets) {
      for (const [, ticket] of enrollment.tickets) {
        if (ticket.status === 'ACTIVE') {
          hasActiveTicket = true;
          activeTicketCount++;
        }
      }
    }

    return responseUtil.success(res, 'Enrollment status retrieved', {
      isEnrolled: hasActiveTicket,
      enrollment: enrollment || null,
      activeTicketCount,
      totalTicketCount: enrollment ? enrollment.ticketCount : 0
    });
  } catch (error) {
    console.error('Check enrollment status error:', error);
    return responseUtil.internalError(res, 'Failed to check enrollment status', error.message);
  }
};

/**
 * Create mock enrollment without payment flow (Testing/Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with enrollment details
 */
export const createMockEnrollment = async (req, res) => {
  try {
    const { eventId, phones } = req.body;
    const userId = req.user.id;

    // Validate phones array
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return responseUtil.badRequest(res, 'Phone numbers array is required and must contain at least one phone number');
    }

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    // Check if enrollment already exists
    const existingEnrollment = await EventEnrollment.findOne({
      userId,
      eventId
    });

    if (existingEnrollment) {
      return responseUtil.conflict(res, 'You are already enrolled in this event');
    }

    // Check if event has enough seats
    if (event.availableSeats < phones.length) {
      return responseUtil.badRequest(res, `Not enough seats available. Only ${event.availableSeats} seats remaining.`);
    }

    // Create mock payment ID and order ID
    const mockPaymentId = `MOCK_PAYMENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockOrderId = `MOCK_ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create tickets map from phone numbers
    const ticketsMap = new Map();
    phones.forEach(phone => {
      ticketsMap.set(phone, {
        status: 'ACTIVE',
        cancelledAt: null,
        cancellationReason: null,
        isTicketScanned: false,
        ticketScannedAt: null,
        ticketScannedBy: null
      });
    });

    // Create enrollment with mock payment data
    const enrollment = new EventEnrollment({
      paymentId: mockPaymentId,
      orderId: mockOrderId,
      userId,
      eventId,
      ticketCount: phones.length,
      tickets: ticketsMap
    });

    await enrollment.save();

    // Decrement available seats
    await Event.findByIdAndUpdate(
      eventId,
      { $inc: { availableSeats: -phones.length } }
    );

    const populatedEnrollment = await EventEnrollment.findById(enrollment._id)
      .populate('eventId', 'name startDate endDate mode city price')
      .populate('userId', 'name email phone');

    return responseUtil.created(res, 'Mock enrollment created successfully', {
      enrollment: populatedEnrollment,
      isMock: true
    });
  } catch (error) {
    console.error('Create mock enrollment error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'You are already enrolled in this event');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create mock enrollment', error.message);
  }
};

export default {
  createEnrollment,
  getUserEnrollments,
  getEnrollmentById,
  getEventAttendees,
  getAllEnrollments,
  cancelEnrollment,
  checkEnrollmentStatus,
  createMockEnrollment
};
