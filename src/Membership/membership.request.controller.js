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
import { sendPaymentLinkNotifications } from '../../utils/notification.util.js';
import { validateCouponForType } from '../Enrollment/coupon.controller.js';

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
    const { phone, name, requestedPlanId, couponCode } = req.body;

    console.log('[MEMBERSHIP-REQUEST] New request submission');
    console.log('[MEMBERSHIP-REQUEST] Phone:', phone, 'Name:', name);
    console.log('[MEMBERSHIP-REQUEST] Requested Plan ID:', requestedPlanId);
    console.log('[MEMBERSHIP-REQUEST] Coupon Code:', couponCode || 'None');

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return responseUtil.badRequest(res, 'Invalid phone number. Please provide a 10-digit phone number.');
    }

    if (!name || name.trim().length < 2) {
      return responseUtil.badRequest(res, 'Name is required (minimum 2 characters).');
    }

    // Check for existing pending request
    const pendingRequest = await MembershipRequest.findOne({
      phone: normalizedPhone,
      status: 'PENDING',
      isDeleted: false,
    }).select('_id createdAt');

    if (pendingRequest) {
      console.log('[MEMBERSHIP-REQUEST] Pending request already exists for phone:', normalizedPhone);
      return responseUtil.conflict(
        res,
        'You already have a pending membership request. You can withdraw the existing request and submit a new one.',
        {
          existingRequestId: pendingRequest._id,
          canWithdraw: true,
          submittedAt: pendingRequest.createdAt,
        }
      );
    }

    // Check for existing COMPLETED request with active membership
    const completedRequest = await MembershipRequest.findOne({
      phone: normalizedPhone,
      status: 'COMPLETED',
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .populate('userMembershipId');

    if (completedRequest && completedRequest.userMembershipId) {
      const membership = completedRequest.userMembershipId;
      const now = new Date();

      // Check if membership is lifetime
      if (
        !membership.isDeleted &&
        membership.status === 'ACTIVE' &&
        membership.isLifetime
      ) {
        console.log(
          '[MEMBERSHIP-REQUEST] Active LIFETIME membership found for phone:',
          normalizedPhone
        );

        return responseUtil.conflict(
          res,
          'You already have an active lifetime membership. You cannot submit a new request.'
        );
      }

      // Check if membership is active and not expired by date
      if (
        !membership.isDeleted &&
        membership.status === 'ACTIVE' &&
        !membership.isLifetime &&
        membership.endDate > now
      ) {
        const daysRemaining = Math.ceil((membership.endDate - now) / (1000 * 60 * 60 * 24));
        console.log(
          '[MEMBERSHIP-REQUEST] Active membership found for phone:',
          normalizedPhone,
          'Days remaining:',
          daysRemaining
        );

        return responseUtil.conflict(
          res,
          `You already have an active membership that expires in ${daysRemaining} day(s). You cannot submit a new request until your current membership expires.`
        );
      }

      // If membership exists but is expired by date, mark it as EXPIRED if status is still ACTIVE
      if (
        !membership.isDeleted &&
        membership.status === 'ACTIVE' &&
        !membership.isLifetime &&
        membership.endDate <= now
      ) {
        console.log('[MEMBERSHIP-REQUEST] Found expired ACTIVE membership, updating status to EXPIRED');
        membership.status = 'EXPIRED';
        await membership.save();

        console.log('[MEMBERSHIP-REQUEST] Membership expired, allowing new request submission');
        // Continue with request creation (membership is now expired)
      }
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

    // Validate coupon if provided (requires a plan to be selected)
    let couponInfo = null;
    if (couponCode) {
      console.log('[MEMBERSHIP-REQUEST] User provided coupon code:', couponCode);

      if (!requestedPlan) {
        console.log('[MEMBERSHIP-REQUEST] Coupon provided but no plan selected');
        return responseUtil.badRequest(res, 'Please select a membership plan to apply a coupon.');
      }

      console.log('[MEMBERSHIP-REQUEST] Validating coupon for plan:', requestedPlan.name, 'Price:', requestedPlan.price);

      const couponValidation = await validateCouponForType(
        couponCode,
        requestedPlan.price,
        normalizedPhone,
        'MEMBERSHIP'
      );

      if (!couponValidation.isValid) {
        console.log('[MEMBERSHIP-REQUEST] Coupon validation failed:', couponValidation.error);
        return responseUtil.badRequest(res, `Coupon error: ${couponValidation.error}`);
      }

      // Store coupon information (admin can later choose to accept or override this)
      couponInfo = {
        couponId: couponValidation.coupon._id,
        couponCode: couponValidation.coupon.code,
        discountPercent: couponValidation.coupon.discountPercent,
        discountAmount: couponValidation.discountAmount,
        originalAmount: requestedPlan.price,
        finalAmount: couponValidation.finalAmount,
      };

      console.log('[MEMBERSHIP-REQUEST] Coupon validated successfully:');
      console.log('  - Original Amount:', couponInfo.originalAmount);
      console.log('  - Discount:', couponInfo.discountAmount, `(${couponInfo.discountPercent}%)`);
      console.log('  - Final Amount:', couponInfo.finalAmount);
    }

    // Check if user already exists in our database
    const existingUser = await User.findOne({
      phone: { $regex: normalizedPhone + '$' },
      isDeleted: false,
    });

    // Create membership request with coupon info if provided
    const membershipRequest = new MembershipRequest({
      phone: normalizedPhone,
      name: name.trim(),
      requestedPlanId: requestedPlan?._id || null,
      existingUserId: existingUser?._id || null,
      status: 'PENDING',
      // Store user's requested coupon (admin can override during approval)
      ...(couponInfo && {
        couponId: couponInfo.couponId,
        couponCode: couponInfo.couponCode,
        discountPercent: couponInfo.discountPercent,
        discountAmount: couponInfo.discountAmount,
        originalAmount: couponInfo.originalAmount,
        paymentAmount: couponInfo.finalAmount,
      }),
    });

    await membershipRequest.save();

    console.log('[MEMBERSHIP-REQUEST] Request created:', membershipRequest._id);
    if (couponInfo) {
      console.log('[MEMBERSHIP-REQUEST] Request includes coupon:', couponInfo.couponCode);
    }

    return responseUtil.created(
      res,
      'Membership request submitted successfully. You will be notified once reviewed.',
      {
        requestId: membershipRequest._id,
        status: membershipRequest.status,
        ...(couponInfo && {
          appliedCoupon: {
            code: couponInfo.couponCode,
            discountPercent: couponInfo.discountPercent,
            originalAmount: couponInfo.originalAmount,
            discountAmount: couponInfo.discountAmount,
            finalAmount: couponInfo.finalAmount,
          },
        }),
      }
    );
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
        .populate('userMembershipId')
        .populate('couponId', 'code discountPercent maxDiscountAmount'),
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
      .populate('userMembershipId')
      .populate('couponId', 'code discountPercent maxDiscountAmount');

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
    const { planId, paymentAmount, adminNotes, sendWhatsApp = true, couponCode, alternativePhone, alternativeEmail, contactPreference } = req.body;
    const adminId = req.user?._id;

    // Normalize and validate contactPreference
    let normalizedContactPreference = contactPreference;
    if (!normalizedContactPreference || !Array.isArray(normalizedContactPreference) || normalizedContactPreference.length === 0) {
      normalizedContactPreference = ['REGISTERED']; // Default to registered contact
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Starting approval process');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Contact preference:', normalizedContactPreference);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Request ID:', id);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Plan ID:', planId);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Payment Amount (override):', paymentAmount);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Coupon Code:', couponCode || 'None');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Send WhatsApp:', sendWhatsApp);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Admin ID:', adminId);
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Admin Notes:', adminNotes);
    console.log('═══════════════════════════════════════════════════════════');

    // Validate request exists and is pending
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 1: Fetching request from database...');
    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    }).populate('existingUserId', 'name email phone');

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

    // Step 3: Process coupon and calculate amounts
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 3: Processing pricing and coupon...');

    const originalAmount = plan.price;
    let discountAmount = 0;
    let discountPercent = 0;
    let finalAmount = originalAmount;
    let appliedCouponId = null;
    let appliedCouponCode = null;

    // If coupon code is provided, validate it
    if (couponCode) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ========== COUPON PROCESSING START ==========');
      console.log('[MEMBERSHIP-REQUEST-APPROVE] Validating coupon:', couponCode);

      const couponValidation = await validateCouponForType(
        couponCode,
        originalAmount,
        request.phone,
        'MEMBERSHIP'
      );

      if (!couponValidation.isValid) {
        console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Coupon validation failed:', couponValidation.error);
        return responseUtil.badRequest(res, `Coupon error: ${couponValidation.error}`);
      }

      // Apply coupon discount
      discountAmount = couponValidation.discountAmount;
      discountPercent = couponValidation.coupon.discountPercent;
      finalAmount = couponValidation.finalAmount;
      appliedCouponId = couponValidation.coupon._id;
      appliedCouponCode = couponValidation.coupon.code;

      console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Coupon validated and applied:');
      console.log('  - Coupon ID:', appliedCouponId);
      console.log('  - Coupon Code:', appliedCouponCode);
      console.log('  - Discount Percent:', discountPercent + '%');
      console.log('  - Original Amount:', originalAmount);
      console.log('  - Discount Amount:', discountAmount);
      console.log('  - Final Amount:', finalAmount);
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ========== COUPON PROCESSING END ==========');
    }

    // If admin provided a custom payment amount, use that instead (overrides coupon)
    let amount = finalAmount;
    if (paymentAmount !== undefined && paymentAmount !== null) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] Admin provided custom payment amount:', paymentAmount);
      console.log('[MEMBERSHIP-REQUEST-APPROVE] This overrides the coupon-calculated amount');
      amount = paymentAmount;
      // Recalculate discount based on admin's custom amount
      discountAmount = originalAmount - amount;
      if (discountAmount < 0) discountAmount = 0;
    }

    console.log('[MEMBERSHIP-REQUEST-APPROVE] Final pricing summary:');
    console.log('  - Plan price (original):', originalAmount);
    console.log('  - Coupon applied:', appliedCouponCode || 'None');
    console.log('  - Discount percent:', discountPercent + '%');
    console.log('  - Discount amount:', discountAmount);
    console.log('  - Final payment amount:', amount);

    if (amount < 0) {
      console.log('[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid amount:', amount);
      return responseUtil.badRequest(res, 'Payment amount cannot be negative');
    }

    // Prepare coupon info for storage
    const couponInfo = appliedCouponCode ? {
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      originalAmount: originalAmount,
    } : null;

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
      amount: originalAmount,
      couponCode: appliedCouponCode,
      discountAmount: discountAmount,
      finalAmount: amount,
      status: 'PENDING',
      metadata: {
        membershipRequestId: request._id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        durationInDays: plan.durationInDays,
        paymentLinkId: paymentLink.id,
        source: 'MEMBERSHIP_REQUEST',
        couponId: appliedCouponId?.toString() || null,
      },
    });

    await payment.save();
    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Payment record created');
    console.log('  - Payment ID:', payment._id);
    console.log('  - Order ID:', payment.orderId);
    console.log('  - Type:', payment.type);
    console.log('  - Original Amount:', payment.amount);
    console.log('  - Coupon Code:', payment.couponCode || 'None');
    console.log('  - Discount Amount:', payment.discountAmount);
    console.log('  - Final Amount:', payment.finalAmount);

    // Update request with approval details and coupon info
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 7: Updating request status to PAYMENT_SENT...');
    request.status = 'PAYMENT_SENT';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.approvedPlanId = plan._id;
    request.originalAmount = originalAmount;
    request.paymentAmount = amount;
    request.couponId = appliedCouponId;
    request.couponCode = appliedCouponCode;
    request.discountPercent = discountPercent;
    request.discountAmount = discountAmount;
    request.adminNotes = adminNotes || null;
    request.alternativePhone = alternativePhone || null;
    request.alternativeEmail = alternativeEmail || null;
    request.contactPreference = normalizedContactPreference;
    request.paymentLinkId = paymentLink.id;
    request.paymentUrl = paymentLink.short_url;
    request.orderId = orderId;

    await request.save();
    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Request updated to PAYMENT_SENT');
    console.log('  - Status:', request.status);
    console.log('  - Original Amount:', request.originalAmount);
    console.log('  - Coupon Code:', request.couponCode || 'None');
    console.log('  - Discount Percent:', request.discountPercent + '%');
    console.log('  - Discount Amount:', request.discountAmount);
    console.log('  - Payment Amount:', request.paymentAmount);
    console.log('  - Payment URL:', request.paymentUrl);
    console.log('  - Payment Link ID:', request.paymentLinkId);

    // Send payment link notifications based on contact preference
    let notificationResults = null;
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 8: Sending payment link notifications...');
    console.log('[NOTIFICATION] Send notifications flag:', sendWhatsApp);
    console.log('[NOTIFICATION] Contact preference:', request.contactPreference);
    console.log('[NOTIFICATION] Registered phone:', request.phone);
    console.log('[NOTIFICATION] Registered email:', request.existingUserId?.email || 'None (user not registered)');
    console.log('[NOTIFICATION] Alternative phone:', request.alternativePhone || 'None');
    console.log('[NOTIFICATION] Alternative email:', request.alternativeEmail || 'None');

    if (sendWhatsApp) {
      try {
        console.log('[NOTIFICATION] Calling sendPaymentLinkNotifications function...');

        notificationResults = await sendPaymentLinkNotifications({
          registeredPhone: request.phone,
          registeredEmail: request.existingUserId?.email || null,
          alternativePhone: request.alternativePhone,
          alternativeEmail: request.alternativeEmail,
          contactPreference: request.contactPreference,
          serviceName: plan.name,
          paymentLink: paymentLink.short_url,
          amount: amount,
          customerName: request.name,
          orderId: request._id.toString(),
        });

        console.log('[NOTIFICATION] ✓ Notifications sent!');
        console.log('[NOTIFICATION] Results:', JSON.stringify(notificationResults, null, 2));

      } catch (notificationError) {
        console.error('[NOTIFICATION] ❌ Failed to send notifications');
        console.error('[NOTIFICATION] Error Name:', notificationError.name);
        console.error('[NOTIFICATION] Error Message:', notificationError.message);
        console.error('[NOTIFICATION] Error Stack:', notificationError.stack);

        // Don't fail the request if notifications fail
        console.log('[NOTIFICATION] Continuing despite notification error (payment link is still valid)');
      }
    } else {
      console.log('[NOTIFICATION] Skipping notifications (sendWhatsApp = false)');
    }

    // Populate response
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Step 9: Preparing response...');
    const populatedRequest = await MembershipRequest.findById(request._id)
      .populate('approvedPlanId', 'name price durationInDays')
      .populate('reviewedBy', 'name username')
      .populate('couponId', 'code discountPercent maxDiscountAmount');

    console.log('[MEMBERSHIP-REQUEST-APPROVE] ✓ Approval process completed successfully!');
    console.log('[MEMBERSHIP-REQUEST-APPROVE] Summary:');
    console.log('  - Request ID:', request._id);
    console.log('  - User:', request.name);
    console.log('  - Phone:', request.phone);
    console.log('  - Plan:', plan.name);
    console.log('  - Original Amount:', originalAmount);
    console.log('  - Coupon:', appliedCouponCode || 'None');
    console.log('  - Discount:', discountAmount, `(${discountPercent}%)`);
    console.log('  - Final Amount:', amount);
    console.log('  - Payment Link:', paymentLink.short_url);
    console.log('  - Notifications:', notificationResults ? JSON.stringify(notificationResults) : 'None');
    console.log('═══════════════════════════════════════════════════════════');

    return responseUtil.success(res, 'Membership request approved. Payment link sent.', {
      request: populatedRequest,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      notifications: notificationResults,
      pricing: {
        originalAmount,
        couponCode: appliedCouponCode,
        discountPercent,
        discountAmount,
        finalAmount: amount,
      },
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
  console.log('\n\n🔥🔥🔥 RESEND PAYMENT LINK FUNCTION CALLED 🔥🔥🔥\n');

  try {
    const { id } = req.params;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[MEMBERSHIP-REQUEST-RESEND] Resending payment link');
    console.log('[MEMBERSHIP-REQUEST-RESEND] Request ID:', id);
    console.log('═══════════════════════════════════════════════════════════');

    const request = await MembershipRequest.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate('approvedPlanId')
      .populate('existingUserId', 'name email phone');

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

    // Normalize contact preference for old database records
    let normalizedContactPreference = request.contactPreference;
    if (!normalizedContactPreference || !Array.isArray(normalizedContactPreference) || normalizedContactPreference.length === 0) {
      normalizedContactPreference = ['REGISTERED'];
      console.log('[MEMBERSHIP-REQUEST-RESEND] Using default contact preference: [REGISTERED]');
    }

    // Send notifications via WhatsApp and/or Email based on contact preference
    console.log('[MEMBERSHIP-REQUEST-RESEND] Sending payment link notifications...');
    console.log('[NOTIFICATION] Parameters:');
    console.log('  - Registered Phone:', request.phone);
    console.log('  - Registered Email:', request.existingUserId?.email || 'None (user not registered)');
    console.log('  - Alternative Phone:', request.alternativePhone || 'None');
    console.log('  - Alternative Email:', request.alternativeEmail || 'None');
    console.log('  - Contact Preference:', normalizedContactPreference);
    console.log('  - Service Name:', request.approvedPlanId?.name || 'Membership');
    console.log('  - Payment Link:', request.paymentUrl);
    console.log('  - Amount:', request.paymentAmount);

    try {
      const notificationResults = await sendPaymentLinkNotifications({
        registeredPhone: request.phone,
        registeredEmail: request.existingUserId?.email || null,
        alternativePhone: request.alternativePhone || null,
        alternativeEmail: request.alternativeEmail || null,
        contactPreference: normalizedContactPreference,
        serviceName: request.approvedPlanId?.name || 'Membership',
        paymentLink: request.paymentUrl,
        amount: request.paymentAmount,
        customerName: request.name,
        orderId: request._id.toString(),
      });

      console.log('[NOTIFICATION] ✓ Notifications sent!');
      console.log('[NOTIFICATION] Results:', JSON.stringify(notificationResults, null, 2));
      console.log('═══════════════════════════════════════════════════════════');

      return responseUtil.success(res, 'Payment link resent successfully', {
        paymentLink: request.paymentUrl,
        notifications: notificationResults,
      });
    } catch (notificationError) {
      console.error('[NOTIFICATION] ❌ Failed to send notifications');
      console.error('[NOTIFICATION] Error Name:', notificationError.name);
      console.error('[NOTIFICATION] Error Message:', notificationError.message);
      console.error('[NOTIFICATION] Error Stack:', notificationError.stack);
      console.error('═══════════════════════════════════════════════════════════');
      return responseUtil.internalError(res, 'Failed to send notifications', notificationError.message);
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
 * Withdraw a pending membership request (public)
 * @route POST /api/web/membership-requests/:id/withdraw
 */
export const withdrawMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Withdrawal request received');
    console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Request ID:', id);
    console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Phone:', phone);

    // Validate phone
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return responseUtil.badRequest(res, 'Invalid phone number.');
    }

    // Find the request
    const request = await MembershipRequest.findOne({
      _id: id,
      phone: normalizedPhone,
      isDeleted: false,
    });

    if (!request) {
      console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Request not found or phone mismatch');
      return responseUtil.notFound(res, 'Membership request not found or phone number mismatch.');
    }

    // Only allow withdrawal of PENDING requests
    if (request.status !== 'PENDING') {
      console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Invalid status for withdrawal:', request.status);
      return responseUtil.badRequest(
        res,
        `Cannot withdraw request with status: ${request.status}. Only PENDING requests can be withdrawn.`
      );
    }

    // Mark as deleted (soft delete)
    request.isDeleted = true;
    request.deletedAt = new Date();
    await request.save();

    console.log('[MEMBERSHIP-REQUEST-WITHDRAW] Request withdrawn successfully');

    return responseUtil.success(res, 'Membership request withdrawn successfully. You can now submit a new request.', {
      withdrawnRequestId: request._id,
    });
  } catch (error) {
    console.error('[MEMBERSHIP-REQUEST-WITHDRAW] Error withdrawing request:', error.message);
    return responseUtil.internalError(res, 'Failed to withdraw membership request', error.message);
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
