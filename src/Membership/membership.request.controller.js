/**
 * @fileoverview Membership Request controller
 * Handles admin-approval membership flow:
 * User submits form → Admin reviews → Admin approves → Payment link sent → User pays → Membership created
 * @module controllers/membershipRequest
 */

import MembershipRequest from '../../schema/MembershipRequest.schema.js';
import MembershipPlan from '../../schema/MembershipPlan.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import Payment from '../../schema/Payment.schema.js';
import User from '../../schema/User.schema.js';
import responseUtil from '../../utils/response.util.js';
import { razorpayInstance } from '../../utils/razorpay.util.js';
import { sendServicePaymentLinkWhatsApp } from '../../utils/whatsapp.util.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * PUBLIC ENDPOINTS
 */

/**
 * Submit a membership request (public - no auth required)
 * @route POST /api/web/membership-requests
 */
export const submitMembershipRequest = async (req, res) => {
  try {
    const { phone, name, requestedPlanId } = req.body;

    console.log('[MEMBERSHIP-REQUEST] New request submission');
    console.log('[MEMBERSHIP-REQUEST] Phone:', phone, 'Name:', name);

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return responseUtil.badRequest(res, 'Invalid phone number. Please provide a 10-digit phone number.');
    }

    if (!name || name.trim().length < 2) {
      return responseUtil.badRequest(res, 'Name is required (minimum 2 characters).');
    }

    // Check for existing pending request
    const hasPending = await MembershipRequest.hasPendingRequest(normalizedPhone);
    if (hasPending) {
      console.log('[MEMBERSHIP-REQUEST] Pending request already exists for phone:', normalizedPhone);
      return responseUtil.conflict(
        res,
        'You already have a pending membership request. Please wait for admin review.'
      );
    }

    // Validate requested plan if provided
    let requestedPlan = null;
    if (requestedPlanId) {
      requestedPlan = await MembershipPlan.findOne({
        _id: requestedPlanId,
        isDeleted: false,
        isActive: true,
      });
      if (!requestedPlan) {
        console.log('[MEMBERSHIP-REQUEST] Invalid plan requested:', requestedPlanId);
        return responseUtil.badRequest(res, 'Selected membership plan is not available.');
      }
    }

    // Check if user already exists in our database
    const existingUser = await User.findOne({
      phone: { $regex: normalizedPhone + '$' },
      isDeleted: false,
    });

    // Create membership request
    const membershipRequest = new MembershipRequest({
      phone: normalizedPhone,
      name: name.trim(),
      requestedPlanId: requestedPlan?._id || null,
      existingUserId: existingUser?._id || null,
      status: 'PENDING',
    });

    await membershipRequest.save();

    console.log('[MEMBERSHIP-REQUEST] Request created:', membershipRequest._id);

    return responseUtil.created(res, 'Membership request submitted successfully. You will be notified once reviewed.', {
      requestId: membershipRequest._id,
      status: membershipRequest.status,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error submitting request:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to submit membership request', error.message);
  }
};

/**
 * Get available membership plans for request form (public)
 * @route GET /api/web/membership-requests/plans
 */
export const getPlansForRequestForm = async (req, res) => {
  try {
    console.log('[MEMBERSHIP-REQUEST] Fetching plans for request form');

    const plans = await MembershipPlan.findActive(false);

    // Return only public-facing fields
    const publicPlans = plans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      compareAtPrice: plan.compareAtPrice,
      durationInDays: plan.durationInDays,
      perks: plan.perks,
      isFeatured: plan.isFeatured,
      isAvailable: plan.isAvailable,
    }));

    return responseUtil.success(res, 'Membership plans fetched successfully', {
      plans: publicPlans,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error fetching plans:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch membership plans', error.message);
  }
};

/**
 * ADMIN ENDPOINTS
 */

/**
 * Get all membership requests (admin)
 * @route GET /api/web/membership-requests
 */
export const getAllMembershipRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    console.log('[MEMBERSHIP-REQUEST] Admin fetching requests - page:', page, 'status:', status);

    const query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (search) {
      const normalizedSearch = normalizePhone(search);
      query.$or = [
        { phone: { $regex: normalizedSearch, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [requests, totalCount] = await Promise.all([
      MembershipRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('requestedPlanId', 'name price durationInDays')
        .populate('approvedPlanId', 'name price durationInDays')
        .populate('reviewedBy', 'name username')
        .populate('existingUserId', 'name email phone enrollments')
        .populate('userMembershipId'),
      MembershipRequest.countDocuments(query),
    ]);

    // Enhance requests with user info
    const enhancedRequests = requests.map((request) => {
      const requestObj = request.toObject();

      // Add isExistingUser flag for easy frontend check
      requestObj.isExistingUser = !!request.existingUserId;

      // If existing user, add enrollment count
      if (request.existingUserId) {
        requestObj.existingUserInfo = {
          _id: request.existingUserId._id,
          name: request.existingUserId.name,
          email: request.existingUserId.email,
          phone: request.existingUserId.phone,
          enrollmentCount: request.existingUserId.enrollments?.length || 0,
        };
      }

      return requestObj;
    });

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    console.log('[MEMBERSHIP-REQUEST] Found', requests.length, 'requests out of', totalCount);

    return responseUtil.success(res, 'Membership requests fetched successfully', {
      requests: enhancedRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error fetching requests:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch membership requests', error.message);
  }
};

/**
 * Get single membership request by ID (admin)
 * @route GET /api/web/membership-requests/:id
 */
export const getMembershipRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[MEMBERSHIP-REQUEST] Fetching request:', id);

    const request = await MembershipRequest.findOne({ _id: id, isDeleted: false })
      .populate('requestedPlanId')
      .populate('approvedPlanId')
      .populate('reviewedBy', 'name username')
      .populate('existingUserId', 'name email phone enrollments createdAt')
      .populate('userMembershipId');

    if (!request) {
      return responseUtil.notFound(res, 'Membership request not found');
    }

    const requestObj = request.toObject();
    requestObj.isExistingUser = !!request.existingUserId;

    if (request.existingUserId) {
      requestObj.existingUserInfo = {
        _id: request.existingUserId._id,
        name: request.existingUserId.name,
        email: request.existingUserId.email,
        phone: request.existingUserId.phone,
        enrollmentCount: request.existingUserId.enrollments?.length || 0,
        registeredAt: request.existingUserId.createdAt,
      };
    }

    return responseUtil.success(res, 'Membership request fetched successfully', {
      request: requestObj,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error fetching request:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch membership request', error.message);
  }
};

/**
 * Approve membership request and send payment link (admin)
 * @route POST /api/web/membership-requests/:id/approve
 */
export const approveMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, paymentAmount, adminNotes, sendWhatsApp = true } = req.body;
    const adminId = req.user?._id;

    console.log('[MEMBERSHIP-REQUEST] Approving request:', id);
    console.log('[MEMBERSHIP-REQUEST] Plan:', planId, 'Amount:', paymentAmount);

    // Validate request exists and is pending
    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Membership request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot approve request with status: ${request.status}. Only PENDING requests can be approved.`
      );
    }

    // Validate plan
    const plan = await MembershipPlan.findOne({
      _id: planId,
      isDeleted: false,
    });

    if (!plan) {
      return responseUtil.notFound(res, 'Membership plan not found');
    }

    const canPurchase = plan.canBePurchased();
    if (!canPurchase.canPurchase) {
      return responseUtil.badRequest(res, canPurchase.reason);
    }

    // Validate payment amount
    const amount = paymentAmount !== undefined && paymentAmount !== null ? paymentAmount : plan.price;
    if (amount < 0) {
      return responseUtil.badRequest(res, 'Payment amount cannot be negative');
    }

    // Generate order ID
    const orderId = `MR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create Razorpay payment link with phone prefill
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const paymentLinkOptions = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      accept_partial: false,
      description: `Membership: ${plan.name}`,
      customer: {
        name: request.name,
        contact: `91${request.phone}`, // Add country code for Razorpay
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: orderId,
        type: 'MEMBERSHIP_REQUEST',
        phone: request.phone,
        requestId: request._id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        durationInDays: plan.durationInDays.toString(),
      },
      callback_url: `${process.env.BASE_URL || 'https://motivata.in'}/membership-payment-success`,
      callback_method: 'get',
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId,
    };

    console.log('[MEMBERSHIP-REQUEST] Creating Razorpay payment link');
    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);

    // Create Payment record for webhook processing
    const payment = new Payment({
      orderId: orderId,
      type: 'MEMBERSHIP_REQUEST',
      phone: request.phone,
      userId: request.existingUserId || null,
      amount: amount,
      finalAmount: amount,
      status: 'PENDING',
      metadata: {
        membershipRequestId: request._id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        durationInDays: plan.durationInDays,
        paymentLinkId: paymentLink.id,
        source: 'MEMBERSHIP_REQUEST',
      },
    });

    await payment.save();
    console.log('[MEMBERSHIP-REQUEST] Payment record created:', payment._id);

    // Update request with approval details
    request.status = 'PAYMENT_SENT';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.approvedPlanId = plan._id;
    request.paymentAmount = amount;
    request.adminNotes = adminNotes || null;
    request.paymentLinkId = paymentLink.id;
    request.paymentUrl = paymentLink.short_url;
    request.orderId = orderId;

    await request.save();
    console.log('[MEMBERSHIP-REQUEST] Request updated to PAYMENT_SENT');

    // Send WhatsApp with payment link
    let whatsappSent = false;
    if (sendWhatsApp) {
      try {
        await sendServicePaymentLinkWhatsApp({
          phone: request.phone,
          serviceName: `${plan.name} Membership`,
          paymentLink: paymentLink.short_url,
          amount: amount,
          serviceOrderId: request._id.toString(),
        });
        whatsappSent = true;
        console.log('[MEMBERSHIP-REQUEST] WhatsApp sent successfully');
      } catch (whatsappError) {
        console.error('[MEMBERSHIP-REQUEST] WhatsApp error:', whatsappError.message);
        // Don't fail the request if WhatsApp fails
      }
    }

    // Populate response
    const populatedRequest = await MembershipRequest.findById(request._id)
      .populate('approvedPlanId', 'name price durationInDays')
      .populate('reviewedBy', 'name username');

    return responseUtil.success(res, 'Membership request approved. Payment link sent.', {
      request: populatedRequest,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      whatsappSent,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error approving request:', error.message);
    return responseUtil.internalError(res, 'Failed to approve membership request', error.message);
  }
};

/**
 * Reject membership request (admin)
 * @route POST /api/web/membership-requests/:id/reject
 */
export const rejectMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user?._id;

    console.log('[MEMBERSHIP-REQUEST] Rejecting request:', id);

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return responseUtil.badRequest(res, 'Rejection reason is required');
    }

    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Membership request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot reject request with status: ${request.status}. Only PENDING requests can be rejected.`
      );
    }

    // Update request
    await request.reject(adminId, rejectionReason.trim(), adminNotes?.trim() || null);

    console.log('[MEMBERSHIP-REQUEST] Request rejected');

    // Populate response
    const populatedRequest = await MembershipRequest.findById(request._id)
      .populate('reviewedBy', 'name username');

    return responseUtil.success(res, 'Membership request rejected', {
      request: populatedRequest,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error rejecting request:', error.message);
    return responseUtil.internalError(res, 'Failed to reject membership request', error.message);
  }
};

/**
 * Resend payment link for approved request (admin)
 * @route POST /api/web/membership-requests/:id/resend-link
 */
export const resendPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[MEMBERSHIP-REQUEST] Resending payment link for request:', id);

    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    }).populate('approvedPlanId');

    if (!request) {
      return responseUtil.notFound(res, 'Membership request not found');
    }

    if (request.status !== 'PAYMENT_SENT') {
      return responseUtil.badRequest(
        res,
        `Cannot resend link for request with status: ${request.status}. Only PAYMENT_SENT requests can have links resent.`
      );
    }

    if (!request.paymentUrl) {
      return responseUtil.badRequest(res, 'No payment link available for this request');
    }

    // Send WhatsApp
    try {
      await sendServicePaymentLinkWhatsApp({
        phone: request.phone,
        serviceName: `${request.approvedPlanId?.name || 'Membership'} Membership`,
        paymentLink: request.paymentUrl,
        amount: request.paymentAmount,
        serviceOrderId: request._id.toString(),
      });

      console.log('[MEMBERSHIP-REQUEST] Payment link resent via WhatsApp');

      return responseUtil.success(res, 'Payment link resent successfully', {
        paymentLink: request.paymentUrl,
      });
    } catch (whatsappError) {
      console.error('[MEMBERSHIP-REQUEST] WhatsApp error:', whatsappError.message);
      return responseUtil.internalError(res, 'Failed to send WhatsApp message', whatsappError.message);
    }
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error resending link:', error.message);
    return responseUtil.internalError(res, 'Failed to resend payment link', error.message);
  }
};

/**
 * Get pending requests count (admin)
 * @route GET /api/web/membership-requests/pending-count
 */
export const getPendingCount = async (req, res) => {
  try {
    const count = await MembershipRequest.getPendingCount();
    return responseUtil.success(res, 'Pending count fetched', { count });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST] Error fetching pending count:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch pending count', error.message);
  }
};
