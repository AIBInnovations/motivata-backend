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
import { validateCouponForType } from '../Enrollment/coupon.controller.js';
import { formatIST } from '../../utils/timezone.util.js';

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
        .populate('eventId', EVENT_PRICING_FIELDS),
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
      .populate('eventId', EVENT_PRICING_FIELDS);

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

const EVENT_PRICING_FIELDS = 'name startDate price pricingTiers';

const resolveRequestPricing = async ({ event, request, pricingTierId, couponCode, paymentAmount }) => {
  const tiers = event.pricingTiers || [];
  let tier = null;
  let baseAmount;

  if (tiers.length > 0) {
    const selectedTierId = pricingTierId || request.pricingTierId;
    tier = selectedTierId
      ? tiers.find((candidate) => String(candidate._id) === String(selectedTierId)) || null
      : null;
    if (!tier && tiers.length === 1) {
      tier = tiers[0];
    }
    if (!tier) {
      return { error: 'This event has more than one price option. Please choose which price to charge.' };
    }
    baseAmount = tier.price;
  } else if (event.price != null) {
    baseAmount = event.price;
  } else {
    return { error: 'This event has no price set. Add a price or a pricing option to the event first.' };
  }

  const manualAmount = paymentAmount != null;
  const codeToApply = manualAmount ? null : (couponCode === undefined ? request.couponCode : couponCode);

  let appliedCouponCode = null;
  let finalAmount = baseAmount;

  if (codeToApply) {
    const couponResult = await validateCouponForType(codeToApply, baseAmount, request.phone, 'EVENT');
    if (!couponResult.isValid) {
      return { error: `Coupon error: ${couponResult.error}` };
    }
    appliedCouponCode = couponResult.coupon.code;
    finalAmount = couponResult.finalAmount;
  }

  if (manualAmount) {
    finalAmount = paymentAmount;
  }

  finalAmount = Math.round(finalAmount * 100) / 100;

  if (finalAmount < 1) {
    return { error: 'The amount to charge must be at least ₹1 to create a payment link.' };
  }

  return {
    tier,
    baseAmount,
    couponCode: appliedCouponCode,
    discountAmount: Math.max(0, Math.round((baseAmount - finalAmount) * 100) / 100),
    finalAmount
  };
};

const buildPaymentLinkDescription = (event, tier) => {
  const when = event.startDate
    ? formatIST(event.startDate, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : '';
  const where = event.mode === 'ONLINE'
    ? 'Online'
    : [event.venueName, event.city].filter(Boolean).join(', ');

  const headline = [
    tier ? `${event.name} (${tier.name})` : event.name,
    when,
    where
  ].filter(Boolean).join(' · ');

  const tierNote = tier?.shortDescription ? ` ${tier.shortDescription}.` : '';
  const about = event.description ? ` ${event.description.trim()}` : '';

  return `${headline}.${tierNote}${about}`.slice(0, 2048);
};

const issuePaymentLink = async ({ request, event, pricing, adminId, notes, sendWhatsApp }) => {
  const amount = pricing.finalAmount;
  const orderId = `ER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const description = buildPaymentLinkDescription(event, pricing.tier);

  const paymentLinkOptions = {
    amount: Math.round(amount * 100),
    currency: 'INR',
    accept_partial: false,
    description,
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
      eventName: event.name,
      ...(pricing.tier && { tierName: pricing.tier.name }),
      ...(pricing.couponCode && { couponCode: pricing.couponCode })
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
    amount: pricing.baseAmount,
    discountAmount: pricing.discountAmount,
    finalAmount: amount,
    couponCode: pricing.couponCode || null,
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
      ...(pricing.tier && {
        priceTierId: pricing.tier._id.toString(),
        tierName: pricing.tier.name
      }),
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
  request.originalAmount = pricing.baseAmount;
  request.discountAmount = pricing.discountAmount;
  request.couponCode = pricing.couponCode;
  request.pricingTierId = pricing.tier ? pricing.tier._id : null;
  request.tierName = pricing.tier ? pricing.tier.name : null;
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
  await request.populate('eventId', EVENT_PRICING_FIELDS);

  return { paymentLink, notificationResults };
};

/**
 * Approve an Event invite request — creates a Razorpay payment link for the
 * event's price (or the chosen pricing tier, less any coupon or admin-set
 * amount) and sends it to the applicant via WhatsApp/email. The request
 * moves to PAYMENT_SENT; the webhook flips it to COMPLETED once paid.
 * @route POST /api/web/event-requests/admin/requests/:id/approve
 * @access Admin only
 */
export const approveEventRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, sendWhatsApp = true, pricingTierId, couponCode, paymentAmount } = req.body;
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

    const pricing = await resolveRequestPricing({ event, request, pricingTierId, couponCode, paymentAmount });
    if (pricing.error) {
      return responseUtil.badRequest(res, pricing.error);
    }

    const { paymentLink, notificationResults } = await issuePaymentLink({
      request,
      event,
      pricing,
      adminId,
      notes,
      sendWhatsApp
    });

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

export const reissueEventRequestPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, sendWhatsApp = true, pricingTierId, couponCode, paymentAmount } = req.body;
    const adminId = req.user?._id;

    const request = await EventRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Event invite request not found');
    }

    if (request.status !== 'PAYMENT_SENT') {
      return responseUtil.badRequest(
        res,
        `Cannot change the payment link of a request with status: ${request.status}. Only requests waiting for payment can be changed.`
      );
    }

    const event = await Event.findOne({ _id: request.eventId, isDeleted: false });
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    const pricing = await resolveRequestPricing({ event, request, pricingTierId, couponCode, paymentAmount });
    if (pricing.error) {
      return responseUtil.badRequest(res, pricing.error);
    }

    if (request.paymentLinkId) {
      let oldLink;
      try {
        oldLink = await razorpayInstance.paymentLink.fetch(request.paymentLinkId);
      } catch (fetchError) {
        console.error('[EVENT-REQUEST-ADMIN] Could not fetch old payment link:', fetchError?.error?.description || fetchError.message);
        return responseUtil.internalError(res, 'Could not check the previous payment link. Please try again.');
      }

      if (oldLink.status === 'paid' || oldLink.status === 'partially_paid') {
        return responseUtil.badRequest(res, 'The previous payment link has already been paid, so it cannot be replaced.');
      }

      if (oldLink.status === 'created') {
        try {
          await razorpayInstance.paymentLink.cancel(request.paymentLinkId);
        } catch (cancelError) {
          console.error('[EVENT-REQUEST-ADMIN] Could not cancel old payment link:', cancelError?.error?.description || cancelError.message);
          return responseUtil.internalError(res, 'Could not cancel the previous payment link. Please try again.');
        }
      }
    }

    if (request.orderId) {
      await Payment.updateOne(
        { orderId: request.orderId, status: 'PENDING' },
        { $set: { status: 'FAILED', failureReason: 'Replaced by a new payment link' } }
      );
    }

    const { paymentLink, notificationResults } = await issuePaymentLink({
      request,
      event,
      pricing,
      adminId,
      notes,
      sendWhatsApp
    });

    console.log('[EVENT-REQUEST-ADMIN] Payment link replaced for request:', id);

    return responseUtil.success(res, 'New payment link sent.', {
      request,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      notifications: notificationResults
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error replacing payment link:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to replace the payment link',
      error.message
    );
  }
};

const BULK_CONCURRENCY = 4;

const runWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

export const bulkSendEventPaymentLinks = async (req, res) => {
  try {
    const {
      eventId,
      recipients,
      pricingTierId,
      couponCode,
      paymentAmount,
      notes,
      sendWhatsApp = true
    } = req.body;
    const adminId = req.user?._id;

    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) {
      return responseUtil.notFound(res, 'Event not found');
    }

    const precheck = await resolveRequestPricing({
      event,
      request: { phone: null, pricingTierId: null, couponCode: null },
      pricingTierId,
      couponCode: null,
      paymentAmount
    });
    if (precheck.error) {
      return responseUtil.badRequest(res, precheck.error);
    }

    const seen = new Set();
    const rows = recipients.map((recipient) => {
      const phone = normalizePhone(String(recipient.phone || ''));
      const name = (recipient.name || '').trim() || 'Guest';
      const email = recipient.email ? String(recipient.email).trim().toLowerCase() : null;
      if (!/^\d{10}$/.test(phone)) {
        return { phone: recipient.phone, name, skip: 'Invalid phone number' };
      }
      if (seen.has(phone)) {
        return { phone, name, skip: 'Duplicate number in this list' };
      }
      seen.add(phone);
      return { phone, name, email };
    });

    console.log('[EVENT-REQUEST-ADMIN] Bulk payment links:', rows.length, 'rows for event', eventId);

    const results = await runWithConcurrency(rows, BULK_CONCURRENCY, async (row) => {
      if (row.skip) {
        return { phone: row.phone, name: row.name, status: 'SKIPPED', reason: row.skip };
      }

      try {
        const existing = await EventRequest.checkDuplicateRequest(row.phone, row.email, event._id);
        if (existing && existing.status !== 'PENDING') {
          return {
            phone: row.phone,
            name: row.name,
            status: 'SKIPPED',
            reason: `Already has a request for this event (${existing.status.replace('_', ' ').toLowerCase()})`,
            requestId: existing._id,
            paymentUrl: existing.paymentUrl || null
          };
        }

        const pricing = await resolveRequestPricing({
          event,
          request: existing || { phone: row.phone, pricingTierId: null, couponCode: null },
          pricingTierId,
          couponCode,
          paymentAmount
        });
        if (pricing.error) {
          return { phone: row.phone, name: row.name, status: 'FAILED', reason: pricing.error };
        }

        const request = existing || await EventRequest.create({
          eventId: event._id,
          phone: row.phone,
          name: row.name,
          email: row.email
        });

        try {
          const { paymentLink, notificationResults } = await issuePaymentLink({
            request,
            event,
            pricing,
            adminId,
            notes: notes || 'Sent via bulk payment links',
            sendWhatsApp
          });
          const whatsappSent = sendWhatsApp
            ? (notificationResults?.whatsapp?.sent?.length || 0) > 0
            : null;
          return {
            phone: row.phone,
            name: request.name,
            status: 'SENT',
            requestId: request._id,
            paymentUrl: paymentLink.short_url,
            amount: pricing.finalAmount,
            whatsappSent
          };
        } catch (linkError) {
          console.error('[EVENT-REQUEST-ADMIN] Bulk link failed for', row.phone, linkError?.error?.description || linkError.message);
          return {
            phone: row.phone,
            name: request.name,
            status: 'FAILED',
            reason: `Payment link could not be created: ${linkError?.error?.description || linkError.message}. The request is saved as pending.`,
            requestId: request._id
          };
        }
      } catch (rowError) {
        console.error('[EVENT-REQUEST-ADMIN] Bulk row failed for', row.phone, rowError.message);
        return { phone: row.phone, name: row.name, status: 'FAILED', reason: rowError.message };
      }
    });

    const summary = {
      total: results.length,
      sent: results.filter((r) => r.status === 'SENT').length,
      skipped: results.filter((r) => r.status === 'SKIPPED').length,
      failed: results.filter((r) => r.status === 'FAILED').length
    };

    console.log('[EVENT-REQUEST-ADMIN] Bulk payment links done:', summary);

    return responseUtil.success(res, `Payment links sent: ${summary.sent} of ${summary.total}`, {
      summary,
      results
    });
  } catch (error) {
    console.error('[EVENT-REQUEST-ADMIN] Error sending bulk payment links:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to send bulk payment links',
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
    await request.populate('eventId', EVENT_PRICING_FIELDS);

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
  bulkSendEventPaymentLinks,
  reissueEventRequestPaymentLink,
  getEventRequestById,
  approveEventRequest,
  rejectEventRequest,
  getEventRequestStats,
  getPendingCount
};
