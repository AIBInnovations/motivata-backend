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

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Starting approval process');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Request ID:', id);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Plan ID:', planId);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Payment Amount:', paymentAmount);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Send WhatsApp:', sendWhatsApp);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Admin ID:', adminId);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Admin Notes:', adminNotes);
    console.log('═══════════════════════════════════════════════════════════');

    // Validate request exists and is pending
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 1: Fetching request from database...');
    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Request not found');
      return responseUtil.notFound(res, 'Membership request not found');
    }

    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Request found');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Request details:');
    console.log('  - Name:', request.name);
    console.log('  - Phone:', request.phone);
    console.log('  - Current Status:', request.status);
    console.log('  - Requested Plan:', request.requestedPlanId);

    if (request.status !== 'PENDING') {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid status:', request.status);
      return responseUtil.badRequest(
        res,
        `Cannot approve request with status: ${request.status}. Only PENDING requests can be approved.`
      );
    }

    // Validate plan
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 2: Validating membership plan...');
    const plan = await MembershipPlan.findOne({
      _id: planId,
      isDeleted: false,
    });

    if (!plan) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Plan not found:', planId);
      return responseUtil.notFound(res, 'Membership plan not found');
    }

    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Plan found:', plan.name);
    console.log('  - Price:', plan.price);
    console.log('  - Duration:', plan.durationInDays, 'days');
    console.log('  - Is Active:', plan.isActive);

    const canPurchase = plan.canBePurchased();
    if (!canPurchase.canPurchase) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Plan cannot be purchased:', canPurchase.reason);
      return responseUtil.badRequest(res, canPurchase.reason);
    }

    // Validate payment amount
    const amount = paymentAmount !== undefined && paymentAmount !== null ? paymentAmount : plan.price;
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 3: Setting payment amount');
    console.log('  - Plan price:', plan.price);
    console.log('  - Custom amount:', paymentAmount);
    console.log('  - Final amount:', amount);

    if (amount < 0) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid amount:', amount);
      return responseUtil.badRequest(res, 'Payment amount cannot be negative');
    }

    // Generate order ID
    const orderId = `MR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 4: Generated Order ID:', orderId);

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

    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 5: Creating Razorpay payment link...');
    console.log('[RAZORPAY] Payment link options:');
    console.log('  - Amount (paise):', paymentLinkOptions.amount);
    console.log('  - Customer Name:', paymentLinkOptions.customer.name);
    console.log('  - Customer Contact:', paymentLinkOptions.customer.contact);
    console.log('  - Description:', paymentLinkOptions.description);
    console.log('  - Expires At:', expiresAt.toISOString());
    console.log('  - Callback URL:', paymentLinkOptions.callback_url);
    console.log('  - Reference ID:', paymentLinkOptions.reference_id);

    let paymentLink;
    try {
      paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);
      console.log('[RAZORPAY] ✓ Payment link created successfully!');
      console.log('[RAZORPAY] Payment Link ID:', paymentLink.id);
      console.log('[RAZORPAY] Short URL:', paymentLink.short_url);
      console.log('[RAZORPAY] Full Response:', JSON.stringify(paymentLink, null, 2));
    } catch (razorpayError) {
      console.error('[RAZORPAY] ❌ Failed to create payment link');
      console.error('[RAZORPAY] Error Name:', razorpayError.name);
      console.error('[RAZORPAY] Error Message:', razorpayError.message);
      console.error('[RAZORPAY] Error Stack:', razorpayError.stack);
      console.error('[RAZORPAY] Full Error:', JSON.stringify(razorpayError, null, 2));
      throw razorpayError;
    }

    // Create Payment record for webhook processing
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 6: Creating Payment record in database...');
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
    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Payment record created');
    console.log('  - Payment ID:', payment._id);
    console.log('  - Order ID:', payment.orderId);
    console.log('  - Type:', payment.type);
    console.log('  - Amount:', payment.amount);

    // Update request with approval details
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 7: Updating request status to PAYMENT_SENT...');
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
    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Request updated to PAYMENT_SENT');
    console.log('  - Status:', request.status);
    console.log('  - Payment URL:', request.paymentUrl);
    console.log('  - Payment Link ID:', request.paymentLinkId);

    // Send WhatsApp with payment link
    let whatsappSent = false;
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 8: Sending WhatsApp notification...');
    console.log('[WHATSAPP] Send WhatsApp flag:', sendWhatsApp);

    if (sendWhatsApp) {
      console.log('[WHATSAPP] Preparing WhatsApp message...');
      console.log('[WHATSAPP] WhatsApp parameters:');
      console.log('  - Phone:', request.phone);
      console.log('  - Service Name:', `${plan.name} Membership`);
      console.log('  - Payment Link:', paymentLink.short_url);
      console.log('  - Amount:', amount);
      console.log('  - Order ID:', request._id.toString());

      try {
        console.log('[WHATSAPP] Calling sendServicePaymentLinkWhatsApp function...');

        const whatsappResult = await sendServicePaymentLinkWhatsApp({
          phone: request.phone,
          serviceName: `${plan.name} Membership`,
          paymentLink: paymentLink.short_url,
          amount: amount,
          serviceOrderId: request._id.toString(),
        });

        whatsappSent = true;
        console.log('[WHATSAPP] ✓ WhatsApp sent successfully!');
        console.log('[WHATSAPP] Result:', JSON.stringify(whatsappResult, null, 2));

      } catch (whatsappError) {
        console.error('[WHATSAPP] ❌ Failed to send WhatsApp');
        console.error('[WHATSAPP] Error Name:', whatsappError.name);
        console.error('[WHATSAPP] Error Message:', whatsappError.message);
        console.error('[WHATSAPP] Error Stack:', whatsappError.stack);
        console.error('[WHATSAPP] Full Error:', JSON.stringify(whatsappError, null, 2));

        // Don't fail the request if WhatsApp fails
        console.log('[WHATSAPP] Continuing despite WhatsApp error (payment link is still valid)');
      }
    } else {
      console.log('[WHATSAPP] Skipping WhatsApp (sendWhatsApp = false)');
    }

    // Populate response
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 9: Preparing response...');
    const populatedRequest = await MembershipRequest.findById(request._id)
      .populate('approvedPlanId', 'name price durationInDays')
      .populate('reviewedBy', 'name username');

    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Approval process completed successfully!');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Summary:');
    console.log('  - Request ID:', request._id);
    console.log('  - User:', request.name);
    console.log('  - Phone:', request.phone);
    console.log('  - Plan:', plan.name);
    console.log('  - Amount:', amount);
    console.log('  - Payment Link:', paymentLink.short_url);
    console.log('  - WhatsApp Sent:', whatsappSent);
    console.log('═══════════════════════════════════════════════════════════');

    return responseUtil.success(res, 'Membership request approved. Payment link sent.', {
      request: populatedRequest,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      whatsappSent,
    });
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[MEMBERSHIP-REQUEST-APPROVE] ❌ FATAL ERROR during approval');
    console.error('[MEMBERSHIP-REQUEST-APPROVE] Error Name:', error.name);
    console.error('[MEMBERSHIP-REQUEST-APPROVE] Error Message:', error.message);
    console.error('[MEMBERSHIP-REQUEST-APPROVE] Error Stack:', error.stack);
    console.error('[MEMBERSHIP-REQUEST-APPROVE] Full Error:', JSON.stringify(error, null, 2));
    console.error('═══════════════════════════════════════════════════════════');
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

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[MEMBERSHIP-REQUEST-RESEND] Resending payment link');
    console.log('[MEMBERSHIP-REQUEST-RESEND] Request ID:', id);
    console.log('═══════════════════════════════════════════════════════════');

    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    }).populate('approvedPlanId');

    if (!request) {
      console.log('[MEMBERSHIP-REQUEST-RESEND] ❌ Request not found');
      return responseUtil.notFound(res, 'Membership request not found');
    }

    console.log('[MEMBERSHIP-REQUEST-RESEND] Request found:');
    console.log('  - Name:', request.name);
    console.log('  - Phone:', request.phone);
    console.log('  - Status:', request.status);
    console.log('  - Payment URL:', request.paymentUrl);

    if (request.status !== 'PAYMENT_SENT') {
      console.log('[MEMBERSHIP-REQUEST-RESEND] ❌ Invalid status:', request.status);
      return responseUtil.badRequest(
        res,
        `Cannot resend link for request with status: ${request.status}. Only PAYMENT_SENT requests can have links resent.`
      );
    }

    if (!request.paymentUrl) {
      console.log('[MEMBERSHIP-REQUEST-RESEND] ❌ No payment URL found');
      return responseUtil.badRequest(res, 'No payment link available for this request');
    }

    // Send WhatsApp
    console.log('[MEMBERSHIP-REQUEST-RESEND] Sending WhatsApp...');
    console.log('[WHATSAPP] Parameters:');
    console.log('  - Phone:', request.phone);
    console.log('  - Service Name:', `${request.approvedPlanId?.name || 'Membership'} Membership`);
    console.log('  - Payment Link:', request.paymentUrl);
    console.log('  - Amount:', request.paymentAmount);

    try {
      const whatsappResult = await sendServicePaymentLinkWhatsApp({
        phone: request.phone,
        serviceName: `${request.approvedPlanId?.name || 'Membership'} Membership`,
        paymentLink: request.paymentUrl,
        amount: request.paymentAmount,
        serviceOrderId: request._id.toString(),
      });

      console.log('[WHATSAPP] ✓ WhatsApp sent successfully!');
      console.log('[WHATSAPP] Result:', JSON.stringify(whatsappResult, null, 2));
      console.log('═══════════════════════════════════════════════════════════');

      return responseUtil.success(res, 'Payment link resent successfully', {
        paymentLink: request.paymentUrl,
      });
    } catch (whatsappError) {
      console.error('[WHATSAPP] ❌ Failed to send WhatsApp');
      console.error('[WHATSAPP] Error Name:', whatsappError.name);
      console.error('[WHATSAPP] Error Message:', whatsappError.message);
      console.error('[WHATSAPP] Error Stack:', whatsappError.stack);
      console.error('═══════════════════════════════════════════════════════════');
      return responseUtil.internalError(res, 'Failed to send WhatsApp message', whatsappError.message);
    }
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[MEMBERSHIP-REQUEST-RESEND] ❌ FATAL ERROR');
    console.error('[MEMBERSHIP-REQUEST-RESEND] Error:', error.message);
    console.error('[MEMBERSHIP-REQUEST-RESEND] Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════');
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
