/**
 * @fileoverview Session controller with CRUD operations and comprehensive error handling
 * @module controllers/session
 */

import Session from "../../schema/Session.schema.js";
import SessionBooking from "../../schema/SessionBooking.schema.js";
import responseUtil from "../../utils/response.util.js";
import { buildPaginationOptions, buildPaginationMeta } from "../shared/pagination.util.js";

/**
 * Create a new session
 * @param {Object} req - Express request object
 * @param {Object} req.body - Session data
 * @param {string} req.body.title - Session title
 * @param {string} req.body.shortDescription - Brief description
 * @param {string} req.body.longDescription - Detailed description
 * @param {number} req.body.price - Session price
 * @param {number} [req.body.compareAtPrice] - Original price for comparison
 * @param {number} req.body.duration - Session duration in minutes
 * @param {string} req.body.sessionType - Session type (OTO/OTM)
 * @param {string} req.body.host - Host name
 * @param {number} [req.body.availableSlots] - Available booking slots
 * @param {string} [req.body.calendlyLink] - Calendly booking link
 * @param {Date} [req.body.sessionDate] - Session date
 * @param {string} [req.body.imageUrl] - Session image URL
 * @param {Object} res - Express response object
 * @returns {Object} Response with created session
 */
export const createSession = async (req, res) => {
  try {
    const sessionData = {
      ...req.body,
      createdBy: req.user.id,
    };

    // Validate compareAtPrice is greater than or equal to price
    if (
      sessionData.compareAtPrice != null &&
      sessionData.compareAtPrice < sessionData.price
    ) {
      return responseUtil.badRequest(
        res,
        "Compare at price must be greater than or equal to current price"
      );
    }

    // Validate OTO sessions have at most 1 slot
    if (
      sessionData.sessionType === "OTO" &&
      sessionData.availableSlots &&
      sessionData.availableSlots > 1
    ) {
      return responseUtil.badRequest(
        res,
        "One-to-One sessions can only have 1 slot"
      );
    }

    const session = new Session(sessionData);
    await session.save();

    return responseUtil.created(res, "Session created successfully", {
      session,
    });
  } catch (error) {
    console.error("Create session error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "A session with this title already exists");
    }

    return responseUtil.internalError(
      res,
      "Failed to create session",
      error.message
    );
  }
};

/**
 * Get all sessions with pagination and filters
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.sortBy=createdAt] - Sort field
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @param {string} [req.query.sessionType] - Filter by session type (OTO/OTM)
 * @param {boolean} [req.query.isLive] - Filter by live status
 * @param {string} [req.query.host] - Filter by host name
 * @param {number} [req.query.minPrice] - Minimum price filter
 * @param {number} [req.query.maxPrice] - Maximum price filter
 * @param {number} [req.query.minDuration] - Minimum duration filter
 * @param {number} [req.query.maxDuration] - Maximum duration filter
 * @param {string} [req.query.search] - Search in title and descriptions
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated sessions
 */
export const getAllSessions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      sessionType,
      isLive,
      host,
      minPrice,
      maxPrice,
      minDuration,
      maxDuration,
      search,
    } = req.query;

    // Validate pagination params
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    // Build query
    const query = {};

    if (sessionType) {
      if (!["OTO", "OTM"].includes(sessionType)) {
        return responseUtil.badRequest(
          res,
          "Invalid session type. Use OTO or OTM"
        );
      }
      query.sessionType = sessionType;
    }

    if (typeof isLive !== "undefined") {
      query.isLive = isLive === "true" || isLive === true;
    }

    if (host) {
      query.host = new RegExp(host, "i");
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        const min = Number(minPrice);
        if (isNaN(min) || min < 0) {
          return responseUtil.badRequest(res, "Invalid minimum price");
        }
        query.price.$gte = min;
      }
      if (maxPrice) {
        const max = Number(maxPrice);
        if (isNaN(max) || max < 0) {
          return responseUtil.badRequest(res, "Invalid maximum price");
        }
        query.price.$lte = max;
      }
    }

    // Duration range filter
    if (minDuration || maxDuration) {
      query.duration = {};
      if (minDuration) {
        const min = Number(minDuration);
        if (isNaN(min) || min < 1) {
          return responseUtil.badRequest(res, "Invalid minimum duration");
        }
        query.duration.$gte = min;
      }
      if (maxDuration) {
        const max = Number(maxDuration);
        if (isNaN(max) || max < 1) {
          return responseUtil.badRequest(res, "Invalid maximum duration");
        }
        query.duration.$lte = max;
      }
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { longDescription: searchRegex },
        { host: searchRegex },
      ];
    }

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Execute query with pagination
    const [sessions, totalCount] = await Promise.all([
      Session.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email"),
      Session.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return responseUtil.success(res, "Sessions fetched successfully", {
      sessions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Get all sessions error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch sessions",
      error.message
    );
  }
};

/**
 * Get single session by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with session details
 */
export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    return responseUtil.success(res, "Session fetched successfully", {
      session,
    });
  } catch (error) {
    console.error("Get session by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch session",
      error.message
    );
  }
};

/**
 * Update session
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} req.body - Updated session data
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated session
 */
export const updateSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const updates = {
      ...req.body,
      updatedBy: req.user.id,
    };

    // Remove fields that shouldn't be updated directly
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;
    delete updates.bookedSlots; // Don't allow direct modification of booked slots

    // Validate compareAtPrice if both price and compareAtPrice are being updated
    if (updates.compareAtPrice != null && updates.price != null) {
      if (updates.compareAtPrice < updates.price) {
        return responseUtil.badRequest(
          res,
          "Compare at price must be greater than or equal to current price"
        );
      }
    }

    // If only compareAtPrice is being updated, check against existing price
    if (updates.compareAtPrice != null && updates.price == null) {
      const existingSession = await Session.findById(id);
      if (!existingSession) {
        return responseUtil.notFound(res, "Session not found");
      }
      if (updates.compareAtPrice < existingSession.price) {
        return responseUtil.badRequest(
          res,
          "Compare at price must be greater than or equal to current price"
        );
      }
    }

    // Validate OTO sessions have at most 1 slot
    const sessionTypeToCheck = updates.sessionType;
    if (sessionTypeToCheck === "OTO" && updates.availableSlots && updates.availableSlots > 1) {
      return responseUtil.badRequest(
        res,
        "One-to-One sessions can only have 1 slot"
      );
    }

    // Check if changing session type and validate slots accordingly
    if (updates.sessionType && !updates.availableSlots) {
      const existingSession = await Session.findById(id);
      if (existingSession && updates.sessionType === "OTO" && existingSession.availableSlots > 1) {
        return responseUtil.badRequest(
          res,
          "Cannot change to One-to-One session type when available slots > 1. Please reduce available slots first."
        );
      }
    }

    const session = await Session.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    return responseUtil.success(res, "Session updated successfully", {
      session,
    });
  } catch (error) {
    console.error("Update session error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to update session",
      error.message
    );
  }
};

/**
 * Soft delete session
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming deletion
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findById(id);

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    // Check if session has active bookings
    if (session.bookedSlots > 0) {
      return responseUtil.badRequest(
        res,
        "Cannot delete session with active bookings. Please cancel all bookings first."
      );
    }

    await session.softDelete(req.user.id);

    return responseUtil.success(res, "Session deleted successfully");
  } catch (error) {
    console.error("Delete session error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to delete session",
      error.message
    );
  }
};

/**
 * Restore soft deleted session
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with restored session
 */
export const restoreSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findOne({ _id: id, isDeleted: true }).select(
      "+isDeleted +deletedAt +deletedBy"
    );

    if (!session) {
      return responseUtil.notFound(res, "Deleted session not found");
    }

    await session.restore();

    return responseUtil.success(res, "Session restored successfully", {
      session,
    });
  } catch (error) {
    console.error("Restore session error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to restore session",
      error.message
    );
  }
};

/**
 * Get all soft deleted sessions
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {Object} res - Express response object
 * @returns {Object} Response with deleted sessions
 */
export const getDeletedSessions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [sessions, totalCount] = await Promise.all([
      Session.findDeleted()
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email")
        .populate("deletedBy", "name email")
        .sort({ deletedAt: -1 }),
      Session.countDocuments({ isDeleted: true }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return responseUtil.success(res, "Deleted sessions fetched successfully", {
      sessions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get deleted sessions error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch deleted sessions",
      error.message
    );
  }
};

/**
 * Permanently delete session (Super Admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming permanent deletion
 */
export const permanentDeleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findById(id).select("+isDeleted");

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    if (!session.isDeleted) {
      return responseUtil.badRequest(res, "Session must be soft deleted first");
    }

    await Session.permanentDelete(id);

    return responseUtil.success(res, "Session permanently deleted");
  } catch (error) {
    console.error("Permanent delete session error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to permanently delete session",
      error.message
    );
  }
};

/**
 * Get available sessions (live and not fully booked)
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.sessionType] - Filter by session type
 * @param {number} [req.query.limit=10] - Number of sessions to return
 * @param {Object} res - Express response object
 * @returns {Object} Response with available sessions
 */
export const getAvailableSessions = async (req, res) => {
  try {
    const { sessionType, limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const filter = {};
    if (sessionType) {
      if (!["OTO", "OTM"].includes(sessionType)) {
        return responseUtil.badRequest(
          res,
          "Invalid session type. Use OTO or OTM"
        );
      }
      filter.sessionType = sessionType;
    }

    const sessions = await Session.findAvailable(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate("createdBy", "name email");

    return responseUtil.success(res, "Available sessions fetched successfully", {
      sessions,
    });
  } catch (error) {
    console.error("Get available sessions error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch available sessions",
      error.message
    );
  }
};

/**
 * Get sessions by host
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.host - Host name
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {Object} res - Express response object
 * @returns {Object} Response with sessions by host
 */
export const getSessionsByHost = async (req, res) => {
  try {
    const { host } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!host) {
      return responseUtil.badRequest(res, "Host name is required");
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      host: new RegExp(host, "i"),
      isLive: true,
    };

    const [sessions, totalCount] = await Promise.all([
      Session.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email"),
      Session.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return responseUtil.success(res, "Sessions fetched successfully", {
      sessions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get sessions by host error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch sessions",
      error.message
    );
  }
};

/**
 * Get session booking statistics
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with session booking stats
 */
export const getSessionBookingStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findById(id).select(
      "title sessionType availableSlots bookedSlots price host isLive"
    );

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    const stats = {
      sessionId: session._id,
      title: session.title,
      host: session.host,
      sessionType: session.sessionType,
      price: session.price,
      isLive: session.isLive,
      availableSlots: session.availableSlots,
      bookedSlots: session.bookedSlots || 0,
      remainingSlots: session.remainingSlots,
      isFullyBooked: session.isFullyBooked,
      bookingPercentage:
        session.availableSlots != null
          ? Math.round(
              ((session.bookedSlots || 0) / session.availableSlots) * 100
            )
          : null,
    };

    return responseUtil.success(
      res,
      "Session booking statistics retrieved successfully",
      { stats }
    );
  } catch (error) {
    console.error("Get session booking stats error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch session booking statistics",
      error.message
    );
  }
};

/**
 * Toggle session live status
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Session ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated session
 */
export const toggleSessionLiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Session ID is required");
    }

    const session = await Session.findById(id);

    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    session.isLive = !session.isLive;
    session.updatedBy = req.user.id;
    await session.save();

    return responseUtil.success(
      res,
      `Session ${session.isLive ? "activated" : "deactivated"} successfully`,
      { session }
    );
  } catch (error) {
    console.error("Toggle session live status error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to toggle session status",
      error.message
    );
  }
};

/**
 * Get sessions for dropdown (lightweight - only _id, title, host)
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {boolean} [req.query.isLive] - Filter by live status
 * @param {string} [req.query.sessionType] - Filter by session type
 * @param {string} [req.query.search] - Search by title
 * @param {Object} res - Express response object
 * @returns {Object} Response with sessions list for dropdown
 */
export const getSessionsForDropdown = async (req, res) => {
  try {
    const { isLive, sessionType, search } = req.query;

    const query = {};

    if (typeof isLive !== "undefined") {
      query.isLive = isLive === "true" || isLive === true;
    }

    if (sessionType) {
      if (!["OTO", "OTM"].includes(sessionType)) {
        return responseUtil.badRequest(
          res,
          "Invalid session type. Use OTO or OTM"
        );
      }
      query.sessionType = sessionType;
    }

    if (search) {
      query.title = new RegExp(search, "i");
    }

    const sessions = await Session.find(query)
      .select("_id title host sessionType isLive price duration")
      .sort({ title: 1 })
      .lean();

    return responseUtil.success(res, "Sessions fetched successfully", {
      sessions,
    });
  } catch (error) {
    console.error("Get sessions for dropdown error:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch sessions",
      error.message
    );
  }
};

/**
 * Get session categories with counts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with categories and counts
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await Session.aggregate([
      { $match: { isDeleted: false, isLive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const categoryLabels = {
      therapeutic: "Therapeutic",
      personal_development: "Personal Development",
      health: "Health",
      mental_wellness: "Mental Wellness",
      career: "Career",
      relationships: "Relationships",
      spirituality: "Spirituality",
      other: "Other",
    };

    const result = categories.map((c) => ({
      key: c._id,
      label: categoryLabels[c._id] || c._id,
      count: c.count,
    }));

    return responseUtil.success(res, "Categories retrieved successfully", { categories: result });
  } catch (error) {
    console.error("Get categories error:", error);
    return responseUtil.internalError(res, "Failed to retrieve categories", error.message);
  }
};

/**
 * Book a session
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Session ID
 * @param {Object} req.body - Booking data
 * @param {Object} res - Express response object
 * @returns {Object} Response with booking details
 */
export const bookSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { contactMethod, userNotes } = req.body;

    console.log("[Session] Booking session:", id, "for user:", userId);

    const session = await Session.findById(id);
    if (!session) {
      return responseUtil.notFound(res, "Session not found");
    }

    if (!session.isLive) {
      return responseUtil.badRequest(res, "Session is not currently available");
    }

    if (session.isFullyBooked) {
      return responseUtil.conflict(res, "Session is fully booked", "SESSION_FULLY_BOOKED");
    }

    // Check for existing pending/confirmed booking
    const existingBooking = await SessionBooking.findOne({
      userId,
      sessionId: id,
      status: { $in: ["pending", "confirmed", "scheduled"] },
    });

    if (existingBooking) {
      return responseUtil.conflict(res, "You already have an active booking for this session");
    }

    // Get user info
    const User = (await import("../../schema/User.schema.js")).default;
    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    // Create booking
    const booking = new SessionBooking({
      userId,
      sessionId: id,
      userEmail: user.email,
      userPhone: user.phone,
      contactMethod: contactMethod || "both",
      userNotes,
      paymentStatus: session.price > 0 ? "pending" : "free",
    });

    await booking.save();

    // Increment booked slots
    await session.bookSlot();

    console.log("[Session] Booking created:", booking.bookingReference);

    return responseUtil.created(res, "Session booked successfully", {
      booking: {
        _id: booking._id,
        bookingReference: booking.bookingReference,
        sessionId: booking.sessionId,
        sessionTitle: session.title,
        host: session.host,
        status: booking.status,
        bookedAt: booking.bookedAt,
        paymentStatus: booking.paymentStatus,
      },
      calendlyLink: session.calendlyLink,
      nextSteps:
        "Please select an available time slot on Calendly. You will receive a confirmation once your booking is confirmed.",
    });
  } catch (error) {
    console.error("Book session error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid session ID format");
    }

    return responseUtil.internalError(res, "Failed to book session", error.message);
  }
};

/**
 * Get user's bookings
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 * @returns {Object} Response with user's bookings
 */
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { skip, limit, sort, page } = buildPaginationOptions(req.query);

    const filter = { userId };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      SessionBooking.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("sessionId", "title host duration imageUrl price category"),
      SessionBooking.countDocuments(filter),
    ]);

    return responseUtil.success(res, "Bookings retrieved successfully", {
      bookings,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    return responseUtil.internalError(res, "Failed to retrieve bookings", error.message);
  }
};

/**
 * Get single booking by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params.bookingId - Booking ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with booking details
 */
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await SessionBooking.findOne({ _id: bookingId, userId }).populate("sessionId");

    if (!booking) {
      return responseUtil.notFound(res, "Booking not found");
    }

    return responseUtil.success(res, "Booking retrieved successfully", { booking });
  } catch (error) {
    console.error("Get booking error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid booking ID format");
    }

    return responseUtil.internalError(res, "Failed to retrieve booking", error.message);
  }
};

/**
 * Cancel booking (user)
 * @param {Object} req - Express request object
 * @param {Object} req.params.bookingId - Booking ID
 * @param {Object} req.body.reason - Cancellation reason
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming cancellation
 */
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    console.log("[Session] Cancelling booking:", bookingId);

    const booking = await SessionBooking.findOne({ _id: bookingId, userId });
    if (!booking) {
      return responseUtil.notFound(res, "Booking not found");
    }

    if (booking.status === "cancelled") {
      return responseUtil.conflict(res, "Booking is already cancelled");
    }

    if (booking.status === "completed") {
      return responseUtil.badRequest(res, "Cannot cancel a completed session");
    }

    // Update booking
    await booking.cancel("user", reason);

    // Release slot
    const session = await Session.findById(booking.sessionId);
    if (session) {
      await session.cancelBooking();
    }

    console.log("[Session] Booking cancelled:", bookingId);

    return responseUtil.success(res, "Booking cancelled successfully", {
      booking: {
        _id: booking._id,
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
      },
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid booking ID format");
    }

    return responseUtil.internalError(res, "Failed to cancel booking", error.message);
  }
};

/**
 * List all bookings (admin)
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 * @returns {Object} Response with all bookings
 */
export const listBookingsAdmin = async (req, res) => {
  try {
    const { skip, limit, sort, page } = buildPaginationOptions(req.query);

    const filter = {};
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.startDate || req.query.endDate) {
      filter.bookedAt = {};
      if (req.query.startDate) filter.bookedAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.bookedAt.$lte = new Date(req.query.endDate);
    }

    const [bookings, total] = await Promise.all([
      SessionBooking.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("sessionId", "title host")
        .populate("userId", "name email phone"),
      SessionBooking.countDocuments(filter),
    ]);

    return responseUtil.success(res, "Bookings retrieved successfully", {
      bookings,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error("List bookings admin error:", error);
    return responseUtil.internalError(res, "Failed to retrieve bookings", error.message);
  }
};

/**
 * Update booking (admin)
 * @param {Object} req - Express request object
 * @param {Object} req.params.bookingId - Booking ID
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated booking
 */
export const updateBookingAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, adminNotes, scheduledSlot } = req.body;

    console.log("[Session] Admin updating booking:", bookingId);

    const booking = await SessionBooking.findById(bookingId);
    if (!booking) {
      return responseUtil.notFound(res, "Booking not found");
    }

    if (status) booking.status = status;
    if (adminNotes) booking.adminNotes = adminNotes;
    if (scheduledSlot) booking.scheduledSlot = scheduledSlot;

    await booking.save();

    console.log("[Session] Booking updated by admin:", bookingId);

    return responseUtil.success(res, "Booking updated successfully", { booking });
  } catch (error) {
    console.error("Update booking admin error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid booking ID format");
    }

    return responseUtil.internalError(res, "Failed to update booking", error.message);
  }
};

export default {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  restoreSession,
  getDeletedSessions,
  permanentDeleteSession,
  getAvailableSessions,
  getSessionsByHost,
  getSessionBookingStats,
  toggleSessionLiveStatus,
  getSessionsForDropdown,
  getCategories,
  bookSession,
  getUserBookings,
  getBookingById,
  cancelBooking,
  listBookingsAdmin,
  updateBookingAdmin,
};
