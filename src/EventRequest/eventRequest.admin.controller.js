/**
 * @fileoverview Event Request admin controller
 * Handles admin operations for invite-only event registration requests
 * @module controllers/eventRequest/admin
 */

import EventRequest from '../../schema/EventRequest.schema.js';
import Event from '../../schema/Event.schema.js';
import Payment from '../../schema/Payment.schema.js';
import responseUtil from '../../utils/response.util.js';
import { razorpayInstance } from '../../utils/razorpay.util.js';
import { sendPaymentLinkNotifications } from '../../utils/notification.util.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * Get all Event invite requests with optional filters
 * @route GET /api/web/event-requests/admin/requests
 * @access Admin only
 */
export const getAllEventRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc',
      eventId
    } = req.query;

    console.log('[EVENT-REQUEST-ADMIN] Fetching requests - page:', page, 'status:', status, 'eventId:', eventId);

    const query = { isDeleted: false };

    // Filter by eventId if provided
    if (eventId) {
      query.eventId = eventId;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name, phone, or email
    if (search) {
      const normalizedSearch = normalizePhone(search);
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: normalizedSearch, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [requests, totalCount] = await Promise.all([
      EventRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reviewedBy', 'name email')
        .populate('eventId', 'name startDate'),
      EventRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    console.log('[EVENT-REQUEST-ADMIN] Found', requests.length, 'requests out of', totalCount);

    return responseUtil.success(res, 'Event invite requests fetched successfully', {
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error fetching requests:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch event invite requests',
      error.message
    );
  }
};

/**
 * Get single Event invite request by ID
 * @route GET /api/web/event-requests/admin/requests/:id
 * @access Admin only
 */
export const getEventRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[EVENT-REQUEST-ADMIN] Fetching request:', id);

    const request = await EventRequest.findOne({
      _id: id,
      isDeleted: false
    })
      .populate('reviewedBy', 'name email')
      .populate('eventId', 'name startDate');

    if (!request) {
      return responseUtil.notFound(res, 'Event invite request not found');
    }

    return responseUtil.success(res, 'Event invite request fetched successfully', {
      request
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error fetching request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch event invite request',
      error.message
    );
  }
};

/**
 * Approve an Event invite request — creates a Razorpay payment link for the
 * event's price and sends it to the applicant via WhatsApp/email. The request
 * moves to PAYMENT_SENT; the webhook flips it to COMPLETED once paid (see
 * updateRelatedEntities in razorpay.webhook.js, which reuses the same ticket
 * creation + WhatsApp-ticket-send path as a normal in-app event booking).
 * @route POST /api/web/event-requests/admin/requests/:id/approve
 * @access Admin only
 */
export const approveEventRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, sendWhatsApp = true } = req.body;
    const adminId = req.user?._id;

    console.log('[EVENT-REQUEST-ADMIN] Approving request:', id);
    console.log('[EVENT-REQUEST-ADMIN] Admin:', adminId);

    const request = await EventRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Event invite request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot approve request with status: ${request.status}. Only PENDING requests can be approved.`
      );
    }

    const event = await Event.findOne({ _id: request.eventId, isDeleted: false });
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    if (event.price == null) {
      return responseUtil.badRequest(
        res,
        'This event uses pricing tiers instead of a flat price. Invite-request approval only supports flat-priced events right now.'
      );
    }

    const amount = event.price;
    const orderId = `ER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const paymentLinkOptions = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      accept_partial: false,
      description: `Event: ${event.name}`,
      customer: {
        name: request.name,
        contact: `91${request.phone}`
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        orderId,
        type: 'EVENT_REQUEST',
        phone: request.phone,
        requestId: request._id.toString(),
        eventId: event._id.toString(),
        eventName: event.name
      },
      callback_url: `${process.env.BASE_URL || 'https://motivata.in'}/event-payment-success`,
      callback_method: 'get',
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId
    };

    console.log('[EVENT-REQUEST-ADMIN] Creating Razorpay payment link:', paymentLinkOptions);

    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);

    console.log('[EVENT-REQUEST-ADMIN] Payment link created:', paymentLink.id, paymentLink.short_url);

    const payment = new Payment({
      type: 'EVENT',
      orderId,
      eventId: event._id,
      phone: request.phone,
      amount,
      discountAmount: 0,
      finalAmount: amount,
      status: 'PENDING',
      metadata: {
        buyer: {
          name: request.name,
          email: request.email || undefined,
          phone: request.phone
        },
        others: [],
        totalTickets: 1,
        perTicketPrice: amount,
        eventRequestId: request._id.toString(),
        paymentLinkId: paymentLink.id,
        source: 'EVENT_REQUEST'
      }
    });

    await payment.save();

    request.status = 'PAYMENT_SENT';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.paymentLinkId = paymentLink.id;
    request.paymentUrl = paymentLink.short_url;
    request.orderId = orderId;
    request.paymentAmount = amount;
    if (notes) {
      request.notes = notes;
    }

    await request.save();

    let notificationResults = null;
    if (sendWhatsApp) {
      try {
        notificationResults = await sendPaymentLinkNotifications({
          registeredPhone: request.phone,
          registeredEmail: request.email || null,
          contactPreference: ['REGISTERED'],
          serviceName: event.name,
          paymentLink: paymentLink.short_url,
          amount,
          customerName: request.name,
          orderId: request._id.toString()
        });
        console.log('[EVENT-REQUEST-ADMIN] Payment link notifications sent:', notificationResults);
      } catch (notificationError) {
        console.error('[EVENT-REQUEST-ADMIN] Failed to send payment link notifications:', notificationError.message);
        // Don't fail the approval — the payment link is still valid, admin can resend manually.
      }
    }

    // Populate for response
    await request.populate('reviewedBy', 'name email');
    await request.populate('eventId', 'name startDate');

    console.log('[EVENT-REQUEST-ADMIN] Request approved, payment link sent successfully');

    return responseUtil.success(res, 'Event invite request approved. Payment link sent.', {
      request,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      notifications: notificationResults
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error approving request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to approve event invite request',
      error.message
    );
  }
};

/**
 * Reject an Event invite request
 * @route POST /api/web/event-requests/admin/requests/:id/reject
 * @access Admin only
 */
export const rejectEventRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?._id;

    console.log('[EVENT-REQUEST-ADMIN] Rejecting request:', id);
    console.log('[EVENT-REQUEST-ADMIN] Admin:', adminId);
    console.log('[EVENT-REQUEST-ADMIN] Rejection notes:', notes);

    if (!notes || notes.trim().length === 0) {
      return responseUtil.badRequest(res, 'Rejection notes are required');
    }

    const request = await EventRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Event invite request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot reject request with status: ${request.status}. Only PENDING requests can be rejected.`
      );
    }

    // Update request
    request.status = 'REJECTED';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.notes = notes;

    await request.save();

    // Populate for response
    await request.populate('reviewedBy', 'name email');
    await request.populate('eventId', 'name startDate');

    console.log('[EVENT-REQUEST-ADMIN] Request rejected successfully');

    return responseUtil.success(res, 'Event invite request rejected successfully', {
      request
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error rejecting request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to reject event invite request',
      error.message
    );
  }
};

/**
 * Get Event invite request statistics
 * Optionally scoped to a single event via ?eventId query param.
 * @route GET /api/web/event-requests/admin/stats
 * @access Admin only
 */
export const getEventRequestStats = async (req, res) => {
  try {
    const { eventId } = req.query;

    console.log('[EVENT-REQUEST-ADMIN] Fetching statistics', eventId ? `for event: ${eventId}` : '(all events)');

    const baseFilter = { isDeleted: false };
    if (eventId) {
      baseFilter.eventId = eventId;
    }

    const [totalRequests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      EventRequest.countDocuments(baseFilter),
      EventRequest.countDocuments({ ...baseFilter, status: 'PENDING' }),
      EventRequest.countDocuments({ ...baseFilter, status: 'APPROVED' }),
      EventRequest.countDocuments({ ...baseFilter, status: 'REJECTED' })
    ]);

    // Requests per day for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requestsPerDay = await EventRequest.aggregate([
      {
        $match: {
          ...baseFilter,
          submittedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1
        }
      }
    ]);

    // Breakdown by event (only meaningful when not already filtered to a single event)
    let requestsPerEvent = [];
    if (!eventId) {
      requestsPerEvent = await EventRequest.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$eventId',
            totalCount: { $sum: 1 },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        {
          $project: {
            _id: 0,
            eventId: '$_id',
            eventTitle: { $arrayElemAt: ['$event.name', 0] },
            totalCount: 1,
            pendingCount: 1,
            approvedCount: 1,
            rejectedCount: 1
          }
        },
        { $sort: { totalCount: -1 } }
      ]);
    }

    const stats = {
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      requestsPerDay,
      ...(requestsPerEvent.length > 0 && { requestsPerEvent })
    };

    console.log('[EVENT-REQUEST-ADMIN] Statistics:', {
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount
    });

    return responseUtil.success(res, 'Event invite request statistics fetched successfully', stats);
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error fetching statistics:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch event invite request statistics',
      error.message
    );
  }
};

/**
 * Get pending invite requests count across all INVITE_ONLY events
 * @route GET /api/web/event-requests/admin/pending-count
 * @access Admin only
 */
export const getPendingCount = async (req, res) => {
  try {
    const pendingCount = await EventRequest.countDocuments({
      isDeleted: false,
      status: 'PENDING'
    });

    // Key must be `count` — the sidebar badge reads result.data.count,
    // matching the same shape as roundTable and membership-request endpoints.
    return responseUtil.success(res, 'Pending count fetched successfully', {
      count: pendingCount
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error fetching pending count:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch pending count',
      error.message
    );
  }
};

export default {
  getAllEventRequests,
  getEventRequestById,
  approveEventRequest,
  rejectEventRequest,
  getEventRequestStats,
  getPendingCount
};
