/**
 * @fileoverview Event Enrollment controller
 * @module controllers/eventEnrollment
 */

import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import Payment from '../../schema/Payment.schema.js';
import Event from '../../schema/Event.schema.js';
import User from '../../schema/User.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create enrollment after successful payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with enrollment details
 */
export const createEnrollment = async (req, res) => {
  try {
    const { paymentId, phones, tierName } = req.body;
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

    // Fetch event to determine pricing structure
    const event = await Event.findById(payment.eventId);
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    // Determine pricing based on event type
    let ticketPrice;
    let selectedTierName = null;

    if (event.pricingTiers && event.pricingTiers.length > 0) {
      // Multi-tier pricing event
      if (!tierName) {
        return responseUtil.badRequest(res, 'Tier name is required for multi-tier pricing events');
      }

      const selectedTier = event.pricingTiers.find(tier => tier.name === tierName);
      if (!selectedTier) {
        return responseUtil.badRequest(res, `Invalid tier name. Available tiers: ${event.pricingTiers.map(t => t.name).join(', ')}`);
      }

      ticketPrice = selectedTier.price;
      selectedTierName = tierName;
    } else {
      // Legacy single-price event
      if (event.price == null) {
        return responseUtil.badRequest(res, 'Event does not have valid pricing information');
      }
      ticketPrice = event.price;
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
      tierName: selectedTierName,
      ticketPrice,
      tickets: ticketsMap
    });

    await enrollment.save();

    // Update event: increment tickets sold and decrement available seats (if exists)
    const updateFields = { $inc: { ticketsSold: phones.length } };

    // Only decrement available seats if the field exists and has value
    if (event.availableSeats != null && event.availableSeats >= phones.length) {
      updateFields.$inc.availableSeats = -phones.length;
    }

    await Event.findByIdAndUpdate(payment.eventId, updateFields);

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
 * Helper to generate all possible phone variations for ticket lookup
 * Handles both old (non-normalized) and new (normalized) phone formats
 * @param {string} phone - User's phone number (typically normalized to 10 digits)
 * @returns {string[]} Array of possible phone variations
 */
const getPhoneVariations = (phone) => {
  const variations = [phone];
  const normalized = phone.length > 10 ? phone.slice(-10) : phone;

  if (!variations.includes(normalized)) {
    variations.push(normalized);
  }

  // Add common variations with country codes
  variations.push(`+91${normalized}`);
  variations.push(`91${normalized}`);
  variations.push(`0${normalized}`);

  return variations;
};

/**
 * Helper to find ticket by phone with variations
 * @param {Map} tickets - Tickets Map from enrollment
 * @param {string} phone - User's phone number
 * @returns {{ ticket: Object|null, matchedPhone: string|null }}
 */
const findTicketInMap = (tickets, phone) => {
  const variations = getPhoneVariations(phone);

  for (const variation of variations) {
    const ticket = tickets.get(variation);
    if (ticket) {
      return { ticket, matchedPhone: variation };
    }
  }

  return { ticket: null, matchedPhone: null };
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

    // Fetch user's phone for ticket lookup
    const user = await User.findById(userId).select('phone');
    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    // Generate all phone variations for ticket lookup
    // Handles both old QRs (with country code) and new normalized phones
    const phoneVariations = getPhoneVariations(user.phone);

    // Build query - find enrollments where user is owner OR has a ticket with any phone variation
    const ticketConditions = phoneVariations.map(phone => ({
      [`tickets.${phone}`]: { $exists: true }
    }));

    const query = {
      $or: [
        { userId: userId },
        ...ticketConditions
      ]
    };

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

    // Enrich enrollments with relationship and myTicket info
    const enrichedEnrollments = enrollments.map(enrollment => {
      const isOwner = enrollment.userId.toString() === userId;
      const enrollmentObj = enrollment.toObject();

      // Find ticket using phone variations
      const { ticket: myTicket, matchedPhone } = findTicketInMap(enrollment.tickets, user.phone);

      return {
        ...enrollmentObj,
        relationship: isOwner ? 'OWNER' : 'TICKET_HOLDER',
        myTicket: myTicket ? {
          phone: matchedPhone,
          status: myTicket.status,
          isTicketScanned: myTicket.isTicketScanned
        } : null,
        // Hide other tickets if not owner
        tickets: isOwner ? enrollmentObj.tickets : undefined
      };
    });

    return responseUtil.success(res, 'Enrollments retrieved successfully', {
      enrollments: enrichedEnrollments,
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

    let query;
    let user = null;

    if (isAdmin) {
      query = { _id: id };
    } else {
      // Fetch user's phone for ticket lookup
      user = await User.findById(userId).select('phone');
      if (!user) {
        return responseUtil.notFound(res, 'User not found');
      }

      // Generate phone variations for ticket lookup
      const phoneVariations = getPhoneVariations(user.phone);
      const ticketConditions = phoneVariations.map(phone => ({
        [`tickets.${phone}`]: { $exists: true }
      }));

      // Find enrollment where user is owner OR has a ticket with any phone variation
      query = {
        _id: id,
        $or: [
          { userId: userId },
          ...ticketConditions
        ]
      };
    }

    const enrollment = await EventEnrollment.findOne(query)
      .populate('eventId', 'name description startDate endDate mode city price imageUrls')
      .populate('userId', 'name email phone')
      .populate('paymentId', 'orderId amount finalAmount discountAmount couponCode');

    if (!enrollment) {
      return responseUtil.notFound(res, 'Enrollment not found');
    }

    // For non-admin users, enrich with relationship and myTicket info
    if (!isAdmin && user) {
      const isOwner = enrollment.userId._id.toString() === userId;
      const enrollmentObj = enrollment.toObject();

      // Find ticket using phone variations
      const { ticket: myTicket, matchedPhone } = findTicketInMap(enrollment.tickets, user.phone);

      return responseUtil.success(res, 'Enrollment retrieved successfully', {
        enrollment: {
          ...enrollmentObj,
          relationship: isOwner ? 'OWNER' : 'TICKET_HOLDER',
          myTicket: myTicket ? {
            phone: matchedPhone,
            status: myTicket.status,
            isTicketScanned: myTicket.isTicketScanned
          } : null,
          // Hide other tickets if not owner
          tickets: isOwner ? enrollmentObj.tickets : undefined
        }
      });
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

    let query;
    let user = null;

    if (isAdmin) {
      query = { _id: id };
    } else {
      // Fetch user's phone for ticket lookup
      user = await User.findById(userId).select('phone');
      if (!user) {
        return responseUtil.notFound(res, 'User not found');
      }

      // Generate phone variations for ticket lookup
      const phoneVariations = getPhoneVariations(user.phone);
      const ticketConditions = phoneVariations.map(p => ({
        [`tickets.${p}`]: { $exists: true }
      }));

      // Find enrollment where user is owner OR has a ticket with any phone variation
      query = {
        _id: id,
        $or: [
          { userId: userId },
          ...ticketConditions
        ]
      };
    }

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

    // For non-admin, non-owner users - validate they can only cancel their own ticket
    const isOwner = enrollment.userId.toString() === userId;

    if (!isAdmin && !isOwner) {
      // Non-owners cannot cancel all tickets
      if (cancelAll) {
        return responseUtil.forbidden(res, 'You can only cancel your own ticket');
      }

      // Non-owners can only cancel their own phone's ticket (check all variations)
      const userPhoneVariations = getPhoneVariations(user.phone);
      const phoneVariations = phone ? getPhoneVariations(phone) : [];
      const hasMatch = userPhoneVariations.some(up => phoneVariations.includes(up));

      if (!hasMatch) {
        return responseUtil.forbidden(res, 'You can only cancel your own ticket');
      }
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
      // Cancel specific ticket by phone (using phone variations)
      const { ticket, matchedPhone } = findTicketInMap(enrollment.tickets, phone);

      if (!ticket || !matchedPhone) {
        return responseUtil.notFound(res, `Ticket for phone ${phone} not found`);
      }

      if (ticket.status !== 'ACTIVE') {
        return responseUtil.badRequest(res, `Ticket for phone ${matchedPhone} is not active`);
      }

      ticket.status = 'CANCELLED';
      ticket.cancelledAt = new Date();
      ticket.cancellationReason = reason || null;
      enrollment.tickets.set(matchedPhone, ticket);
      cancelledCount = 1;
    } else {
      return responseUtil.badRequest(res, 'Either provide phone number to cancel specific ticket or set cancelAll to true');
    }

    await enrollment.save();

    // Update event: decrement tickets sold and increment available seats (if exists)
    if (cancelledCount > 0) {
      const event = await Event.findById(enrollment.eventId._id);

      const updateFields = { $inc: { ticketsSold: -cancelledCount } };

      // Only increment available seats if the field exists
      if (event && event.availableSeats != null) {
        updateFields.$inc.availableSeats = cancelledCount;
      }

      await Event.findByIdAndUpdate(enrollment.eventId._id, updateFields);
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

    // Fetch user's phone for ticket lookup
    const user = await User.findById(userId).select('phone');
    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    // Generate phone variations for ticket lookup
    const phoneVariations = getPhoneVariations(user.phone);
    const ticketConditions = phoneVariations.map(phone => ({
      [`tickets.${phone}`]: { $exists: true }
    }));

    // Find enrollment where user is owner OR has a ticket with any phone variation
    const enrollment = await EventEnrollment.findOne({
      eventId,
      $or: [
        { userId: userId },
        ...ticketConditions
      ]
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

    // Determine relationship and user's ticket using phone variations
    const isOwner = enrollment ? enrollment.userId.toString() === userId : false;
    const { ticket: myTicket, matchedPhone } = enrollment
      ? findTicketInMap(enrollment.tickets, user.phone)
      : { ticket: null, matchedPhone: null };

    return responseUtil.success(res, 'Enrollment status retrieved', {
      isEnrolled: hasActiveTicket,
      relationship: enrollment ? (isOwner ? 'OWNER' : 'TICKET_HOLDER') : null,
      myTicket: myTicket ? {
        phone: matchedPhone,
        status: myTicket.status,
        isTicketScanned: myTicket.isTicketScanned
      } : null,
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
    const { eventId, phones, tierName } = req.body;
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

    // Determine pricing based on event type
    let ticketPrice;
    let selectedTierName = null;

    if (event.pricingTiers && event.pricingTiers.length > 0) {
      // Multi-tier pricing event
      if (!tierName) {
        return responseUtil.badRequest(res, 'Tier name is required for multi-tier pricing events');
      }

      const selectedTier = event.pricingTiers.find(tier => tier.name === tierName);
      if (!selectedTier) {
        return responseUtil.badRequest(res, `Invalid tier name. Available tiers: ${event.pricingTiers.map(t => t.name).join(', ')}`);
      }

      ticketPrice = selectedTier.price;
      selectedTierName = tierName;
    } else {
      // Legacy single-price event
      if (event.price == null) {
        return responseUtil.badRequest(res, 'Event does not have valid pricing information');
      }
      ticketPrice = event.price;
    }

    // Check if enrollment already exists
    const existingEnrollment = await EventEnrollment.findOne({
      userId,
      eventId
    });

    if (existingEnrollment) {
      return responseUtil.conflict(res, 'You are already enrolled in this event');
    }

    // Check if event has enough seats (only if availableSeats is tracked)
    if (event.availableSeats != null && event.availableSeats < phones.length) {
      return responseUtil.badRequest(res, `Not enough seats available. Only ${event.availableSeats} seats remaining.`);
    }

    // Create mock payment ID and order ID
    const mockPaymentId = `MOCK_PAYMENT_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const mockOrderId = `MOCK_ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

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
      tierName: selectedTierName,
      ticketPrice,
      tickets: ticketsMap
    });

    await enrollment.save();

    // Update event: increment tickets sold and decrement available seats (if exists)
    const updateFields = { $inc: { ticketsSold: phones.length } };

    // Only decrement available seats if the field exists and has value
    if (event.availableSeats != null && event.availableSeats >= phones.length) {
      updateFields.$inc.availableSeats = -phones.length;
    }

    await Event.findByIdAndUpdate(eventId, updateFields);

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
