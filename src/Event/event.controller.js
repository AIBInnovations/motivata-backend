/**
 * @fileoverview Event controller with CRUD operations
 * @module controllers/event
 */

import Event from '../../schema/Event.schema.js';
import responseUtil from '../../utils/response.util.js';
import { sendNewEventNotification } from '../../utils/fcm.util.js';

/**
 * Create a new event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with created event
 */
export const createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user.id
    };

    const event = new Event(eventData);
    await event.save();

    // Send push notification to all app users (non-blocking)
    sendNewEventNotification({
      eventId: event._id,
      eventName: event.name,
      eventCategory: event.category,
      startDate: event.startDate,
    }).catch((err) => {
      console.error('[Event] Failed to send new event notification:', err.message);
    });

    return responseUtil.created(res, 'Event created successfully', { event });
  } catch (error) {
    console.error('Create event error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create event', error.message);
  }
};

/**
 * Get all events with pagination and filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated events
 */
export const getAllEvents = async (req, res) => {
  try {
    // Update all expired events first
    await Event.updateExpiredEvents();

    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      category,
      mode,
      city,
      isLive,
      featured,
      minPrice,
      maxPrice,
      startDateFrom,
      startDateTo,
      search
    } = req.query;

    // Build query
    const query = {};

    if (category) query.category = category;
    if (mode) query.mode = mode;
    if (city) query.city = new RegExp(city, 'i');
    if (typeof isLive !== 'undefined') query.isLive = isLive;
    if (typeof featured !== 'undefined') query.featured = featured;

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Date range filter
    if (startDateFrom || startDateTo) {
      query.startDate = {};
      if (startDateFrom) query.startDate.$gte = new Date(startDateFrom);
      if (startDateTo) query.startDate.$lte = new Date(startDateTo);
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [events, totalCount] = await Promise.all([
      Event.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Event.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return responseUtil.success(res, 'Events fetched successfully', {
      events,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get all events error:', error);
    return responseUtil.internalError(res, 'Failed to fetch events', error.message);
  }
};

/**
 * Get single event by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with event details
 */
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    // Update event status if expired
    await event.updateEventStatus();

    return responseUtil.success(res, 'Event fetched successfully', { event });
  } catch (error) {
    console.error('Get event by ID error:', error);

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to fetch event', error.message);
  }
};

/**
 * Update event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated event
 */
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // First fetch the existing event to merge values for cross-field validation
    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      return responseUtil.notFound(res, 'Event not found');
    }

    const updates = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Remove fields that shouldn't be updated directly
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;

    // Cross-field validation for partial updates
    // Use existing values when the field is not being updated
    const finalStartDate = updates.startDate ? new Date(updates.startDate) : existingEvent.startDate;
    const finalEndDate = updates.endDate ? new Date(updates.endDate) : existingEvent.endDate;
    const finalPrice = updates.price !== undefined ? updates.price : existingEvent.price;
    const finalCompareAtPrice = updates.compareAtPrice !== undefined ? updates.compareAtPrice : existingEvent.compareAtPrice;

    // Validate endDate > startDate
    if (finalEndDate <= finalStartDate) {
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'endDate', message: 'End date must be after start date' }
      ]);
    }

    // Validate compareAtPrice >= price (if compareAtPrice is set)
    if (finalCompareAtPrice != null && finalCompareAtPrice < finalPrice) {
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'compareAtPrice', message: 'Compare at price must be greater than or equal to current price' }
      ]);
    }

    // Validate pricingTiers compareAtPrice if present in updates
    if (updates.pricingTiers && Array.isArray(updates.pricingTiers)) {
      for (let i = 0; i < updates.pricingTiers.length; i++) {
        const tier = updates.pricingTiers[i];
        if (tier.compareAtPrice != null && tier.compareAtPrice < tier.price) {
          return responseUtil.validationError(res, 'Validation failed', [
            { field: `pricingTiers.${i}.compareAtPrice`, message: 'Tier compare at price must be greater than or equal to tier price' }
          ]);
        }
      }
    }

    // Now perform the update without relying on schema-level cross-field validators
    const event = await Event.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    return responseUtil.success(res, 'Event updated successfully', { event });
  } catch (error) {
    console.error('Update event error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to update event', error.message);
  }
};

/**
 * Soft delete event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming deletion
 */
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    await event.softDelete(req.user.id);

    return responseUtil.success(res, 'Event deleted successfully');
  } catch (error) {
    console.error('Delete event error:', error);

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to delete event', error.message);
  }
};

/**
 * Restore soft deleted event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with restored event
 */
export const restoreEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({ _id: id, isDeleted: true })
      .select('+isDeleted +deletedAt +deletedBy');

    if (!event) {
      return responseUtil.notFound(res, 'Deleted event not found');
    }

    await event.restore();

    return responseUtil.success(res, 'Event restored successfully', { event });
  } catch (error) {
    console.error('Restore event error:', error);

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to restore event', error.message);
  }
};

/**
 * Get all soft deleted events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with deleted events
 */
export const getDeletedEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [events, totalCount] = await Promise.all([
      Event.findDeleted()
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email')
        .populate('deletedBy', 'name email')
        .sort({ deletedAt: -1 }),
      Event.countDocuments({ isDeleted: true })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Deleted events fetched successfully', {
      events,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get deleted events error:', error);
    return responseUtil.internalError(res, 'Failed to fetch deleted events', error.message);
  }
};

/**
 * Permanently delete event (Super Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming permanent deletion
 */
export const permanentDeleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).select('+isDeleted');

    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    if (!event.isDeleted) {
      return responseUtil.badRequest(res, 'Event must be soft deleted first');
    }

    await Event.permanentDelete(id);

    return responseUtil.success(res, 'Event permanently deleted');
  } catch (error) {
    console.error('Permanent delete event error:', error);

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to permanently delete event', error.message);
  }
};

/**
 * Update expired events status (can be called via cron job)
 * @param {Object} _req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with update count
 */
export const updateExpiredEvents = async (_req, res) => {
  try {
    const result = await Event.updateExpiredEvents();

    return responseUtil.success(res, 'Expired events updated successfully', {
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Update expired events error:', error);
    return responseUtil.internalError(res, 'Failed to update expired events', error.message);
  }
};

/**
 * Get upcoming events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with upcoming events
 */
export const getUpcomingEvents = async (req, res) => {
  try {
    // Update all expired events first
    await Event.updateExpiredEvents();

    const { limit = 10 } = req.query;

    const events = await Event.find({
      startDate: { $gt: new Date() },
      isLive: true
    })
      .sort({ startDate: 1 })
      .limit(Number(limit))
      .populate('createdBy', 'name email');

    return responseUtil.success(res, 'Upcoming events fetched successfully', { events });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    return responseUtil.internalError(res, 'Failed to fetch upcoming events', error.message);
  }
};

/**
 * Get events by category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with events in specified category
 */
export const getEventsByCategory = async (req, res) => {
  try {
    // Update all expired events first
    await Event.updateExpiredEvents();

    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [events, totalCount] = await Promise.all([
      Event.find({ category, isLive: true })
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Event.countDocuments({ category, isLive: true })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Events fetched successfully', {
      events,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get events by category error:', error);
    return responseUtil.internalError(res, 'Failed to fetch events', error.message);
  }
};

/**
 * Get event tickets sold statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with tickets sold statistics
 */
export const getEventTicketStats = async (req, res) => {
  try {
    // Update all expired events first
    await Event.updateExpiredEvents();

    const { id } = req.params;

    const event = await Event.findById(id)
      .select('name ticketsSold availableSeats pricingTiers price');

    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    const stats = {
      eventId: event._id,
      eventName: event.name,
      ticketsSold: event.ticketsSold || 0,
      availableSeats: event.availableSeats,
      hasAvailableSeatsTracking: event.availableSeats != null
    };

    // Calculate tier-based stats if multi-tier pricing
    if (event.pricingTiers && event.pricingTiers.length > 0) {
      stats.pricingType = 'multi-tier';
      stats.tiers = event.pricingTiers.map(tier => ({
        tierId: tier._id,
        name: tier.name,
        price: tier.price,
        ticketQuantity: tier.ticketQuantity || 1
      }));
    } else {
      stats.pricingType = 'single';
      stats.price = event.price;
    }

    return responseUtil.success(res, 'Event ticket statistics retrieved successfully', { stats });
  } catch (error) {
    console.error('Get event ticket stats error:', error);

    if (error.name === 'CastError') {
      return responseUtil.badRequest(res, 'Invalid event ID');
    }

    return responseUtil.internalError(res, 'Failed to fetch event ticket statistics', error.message);
  }
};

/**
 * Get all events for dropdown (lightweight - only _id and name)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with events list for dropdown
 */
export const getEventsForDropdown = async (req, res) => {
  try {
    const { isLive, search } = req.query;

    const query = {};

    // Optional filter for live events only
    if (typeof isLive !== 'undefined') {
      query.isLive = isLive === 'true';
    }

    // Optional search filter
    if (search) {
      query.name = new RegExp(search, 'i');
    }

    const events = await Event.find(query)
      .select('_id name startDate isLive category')
      .sort({ name: 1 })
      .lean();

    return responseUtil.success(res, 'Events fetched successfully', { events });
  } catch (error) {
    console.error('Get events for dropdown error:', error);
    return responseUtil.internalError(res, 'Failed to fetch events', error.message);
  }
};

/**
 * Get all featured events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with featured events
 */
export const getFeaturedEvents = async (req, res) => {
  try {
    // Update all expired events first
    await Event.updateExpiredEvents();

    const { limit = 10 } = req.query;

    const events = await Event.find({
      featured: true,
      isLive: true
    })
      .sort({ startDate: 1 })
      .limit(Number(limit))
      .populate('createdBy', 'name email');

    return responseUtil.success(res, 'Featured events fetched successfully', { events });
  } catch (error) {
    console.error('Get featured events error:', error);
    return responseUtil.internalError(res, 'Failed to fetch featured events', error.message);
  }
};

export default {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  restoreEvent,
  getDeletedEvents,
  permanentDeleteEvent,
  updateExpiredEvents,
  getUpcomingEvents,
  getEventsByCategory,
  getEventTicketStats,
  getEventsForDropdown,
  getFeaturedEvents
};
