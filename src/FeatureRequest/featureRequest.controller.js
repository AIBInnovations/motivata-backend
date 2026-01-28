/**
 * @fileoverview Feature Request controller
 * Handles admin-approval feature access purchase flow:
 * User submits form with selected features → Admin reviews → Admin approves → Payment link sent → User pays → Feature access created
 * @module controllers/featureRequest
 */

import FeatureRequest from '../../schema/FeatureRequest.schema.js';
import FeaturePricing from '../../schema/FeaturePricing.schema.js';
import UserFeatureAccess from '../../schema/UserFeatureAccess.schema.js';
import Payment from '../../schema/Payment.schema.js';
import User from '../../schema/User.schema.js';
import responseUtil from '../../utils/response.util.js';
import { razorpayInstance } from '../../utils/razorpay.util.js';
import { sendServicePaymentLinkWhatsApp } from '../../utils/whatsapp.util.js';
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
 * Get available feature pricing options for request form (public)
 * @route GET /api/web/feature-requests/pricing
 */
export const getFeaturePricing = async (req, res) => {
  try {
    console.log('[FEATURE-REQUEST] Fetching pricing options for request form');

    const pricingOptions = await FeaturePricing.findActive(false);

    // Return only public-facing fields
    const publicPricing = pricingOptions.map((pricing) => ({
      _id: pricing._id,
      featureKey: pricing.featureKey,
      name: pricing.name,
      description: pricing.description,
      price: pricing.price,
      compareAtPrice: pricing.compareAtPrice,
      durationInDays: pricing.durationInDays,
      isLifetime: pricing.isLifetime,
      isBundle: pricing.isBundle,
      includedFeatures: pricing.includedFeatures,
      perks: pricing.perks,
      isFeatured: pricing.isFeatured,
      isAvailable: pricing.isAvailable,
    }));

    // Separate individual features and bundles
    const individualFeatures = publicPricing.filter(p => !p.isBundle);
    const bundles = publicPricing.filter(p => p.isBundle);

    return responseUtil.success(res, 'Feature pricing fetched successfully', {
      pricing: publicPricing,
      individualFeatures,
      bundles,
    });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error fetching pricing:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch feature pricing', error.message);
  }
};

/**
 * Submit a feature access request (public - no auth required)
 * @route POST /api/web/feature-requests
 */
export const submitFeatureRequest = async (req, res) => {
  try {
    const { phone, name, requestedFeatures, bundleId, couponCode } = req.body;

    console.log('[FEATURE-REQUEST] New request submission');
    console.log('[FEATURE-REQUEST] Phone:', phone, 'Name:', name);
    console.log('[FEATURE-REQUEST] Requested Features:', requestedFeatures);
    console.log('[FEATURE-REQUEST] Bundle ID:', bundleId || 'None');
    console.log('[FEATURE-REQUEST] Coupon Code:', couponCode || 'None');

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return responseUtil.badRequest(res, 'Invalid phone number. Please provide a 10-digit phone number.');
    }

    if (!name || name.trim().length < 2) {
      return responseUtil.badRequest(res, 'Name is required (minimum 2 characters).');
    }

    // Validate that at least one feature is selected OR a bundle is selected
    if ((!requestedFeatures || requestedFeatures.length === 0) && !bundleId) {
      return responseUtil.badRequest(res, 'Please select at least one feature or a bundle.');
    }

    // Normalize and validate requested features
    let featureKeys = [];
    if (requestedFeatures && requestedFeatures.length > 0) {
      featureKeys = requestedFeatures.map(f => (typeof f === 'string' ? f : f.featureKey).toUpperCase());
      const validFeatures = ['SOS', 'CONNECT', 'CHALLENGE'];
      const invalidFeatures = featureKeys.filter(f => !validFeatures.includes(f));
      if (invalidFeatures.length > 0) {
        return responseUtil.badRequest(res, `Invalid features: ${invalidFeatures.join(', ')}. Valid options: SOS, CONNECT, CHALLENGE.`);
      }
    }

    // If bundle is selected, get features from bundle
    let bundle = null;
    if (bundleId) {
      bundle = await FeaturePricing.findOne({
        _id: bundleId,
        isBundle: true,
        isDeleted: false,
        isActive: true,
      });
      if (!bundle) {
        return responseUtil.badRequest(res, 'Selected bundle is not available.');
      }
      featureKeys = bundle.includedFeatures;
    }

    // Check for existing pending request for any of the selected features
    const pendingRequest = await FeatureRequest.findOne({
      phone: normalizedPhone,
      status: 'PENDING',
      isDeleted: false,
      'requestedFeatures.featureKey': { $in: featureKeys }
    }).select('_id createdAt requestedFeatures');

    if (pendingRequest) {
      console.log('[FEATURE-REQUEST] Pending request already exists for phone:', normalizedPhone);
      return responseUtil.conflict(
        res,
        'You already have a pending feature request that includes some of the selected features. You can withdraw the existing request and submit a new one.',
        {
          existingRequestId: pendingRequest._id,
          existingFeatures: pendingRequest.requestedFeatures.map(f => f.featureKey),
          canWithdraw: true,
          submittedAt: pendingRequest.createdAt,
        }
      );
    }

    // Check for existing active access to any of the selected features
    const existingAccess = await UserFeatureAccess.findActiveByPhone(normalizedPhone);
    const existingFeatureKeys = existingAccess.map(a => a.featureKey);
    const overlappingFeatures = featureKeys.filter(f => existingFeatureKeys.includes(f));

    if (overlappingFeatures.length > 0) {
      console.log('[FEATURE-REQUEST] User already has access to features:', overlappingFeatures);
      return responseUtil.conflict(
        res,
        `You already have active access to: ${overlappingFeatures.join(', ')}. Please select different features.`,
        {
          existingAccess: overlappingFeatures,
        }
      );
    }

    // Calculate total price for coupon validation
    let totalPrice = 0;
    if (bundle) {
      totalPrice = bundle.price;
    } else {
      // Sum up individual feature prices
      for (const featureKey of featureKeys) {
        const pricing = await FeaturePricing.findByFeatureKey(featureKey);
        if (pricing) {
          totalPrice += pricing.price;
        }
      }
    }

    // Validate coupon if provided
    let couponInfo = null;
    if (couponCode && totalPrice > 0) {
      console.log('[FEATURE-REQUEST] Validating coupon:', couponCode);

      const couponValidation = await validateCouponForType(
        couponCode,
        totalPrice,
        normalizedPhone,
        'FEATURE'
      );

      if (!couponValidation.isValid) {
        console.log('[FEATURE-REQUEST] Coupon validation failed:', couponValidation.error);
        return responseUtil.badRequest(res, `Coupon error: ${couponValidation.error}`);
      }

      couponInfo = {
        couponId: couponValidation.coupon._id,
        couponCode: couponValidation.coupon.code,
        discountPercent: couponValidation.coupon.discountPercent,
        discountAmount: couponValidation.discountAmount,
        originalAmount: totalPrice,
        finalAmount: couponValidation.finalAmount,
      };

      console.log('[FEATURE-REQUEST] Coupon validated:', couponInfo.couponCode);
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      phone: { $regex: normalizedPhone + '$' },
      isDeleted: false,
    });

    // Create feature request
    const featureRequest = new FeatureRequest({
      phone: normalizedPhone,
      name: name.trim(),
      requestedFeatures: featureKeys.map(featureKey => ({ featureKey })),
      requestedBundleId: bundle?._id || null,
      existingUserId: existingUser?._id || null,
      status: 'PENDING',
      ...(couponInfo && {
        couponId: couponInfo.couponId,
        couponCode: couponInfo.couponCode,
        discountPercent: couponInfo.discountPercent,
        discountAmount: couponInfo.discountAmount,
        originalAmount: couponInfo.originalAmount,
        paymentAmount: couponInfo.finalAmount,
      }),
    });

    await featureRequest.save();

    console.log('[FEATURE-REQUEST] Request created:', featureRequest._id);

    return responseUtil.created(
      res,
      'Feature access request submitted successfully. You will be notified once reviewed.',
      {
        requestId: featureRequest._id,
        status: featureRequest.status,
        requestedFeatures: featureKeys,
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
    console.error('[FEATURE-REQUEST] Error submitting request:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to submit feature request', error.message);
  }
};

/**
 * Withdraw a pending feature request (public)
 * @route POST /api/web/feature-requests/:id/withdraw
 */
export const withdrawFeatureRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    console.log('[FEATURE-REQUEST] Withdraw request:', id);

    if (!phone) {
      return responseUtil.badRequest(res, 'Phone number is required for verification.');
    }

    const normalizedPhone = normalizePhone(phone);

    const request = await FeatureRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Feature request not found');
    }

    // Verify phone matches
    if (request.phone !== normalizedPhone) {
      return responseUtil.forbidden(res, 'Phone number does not match the request.');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot withdraw request with status: ${request.status}. Only PENDING requests can be withdrawn.`
      );
    }

    // Soft delete the request
    await request.softDelete();

    console.log('[FEATURE-REQUEST] Request withdrawn:', id);

    return responseUtil.success(res, 'Feature request withdrawn successfully.', {
      requestId: request._id,
      status: 'WITHDRAWN',
    });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error withdrawing request:', error.message);
    return responseUtil.internalError(res, 'Failed to withdraw feature request', error.message);
  }
};

/**
 * ADMIN ENDPOINTS
 */

/**
 * Get all feature requests (admin)
 * @route GET /api/web/feature-requests
 */
export const getAllFeatureRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, featureKey, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    console.log('[FEATURE-REQUEST] Admin fetching requests - page:', page, 'status:', status);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { isDeleted: false };

    if (status) {
      query.status = status.toUpperCase();
    }

    if (featureKey) {
      query['requestedFeatures.featureKey'] = featureKey.toUpperCase();
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { phone: searchRegex },
        { name: searchRegex },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [requests, total] = await Promise.all([
      FeatureRequest.find(query)
        .populate('requestedBundleId', 'name featureKey price')
        .populate('reviewedBy', 'name username')
        .populate('couponId', 'code discountPercent')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      FeatureRequest.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return responseUtil.success(res, 'Feature requests fetched successfully', {
      requests,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error fetching requests:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch feature requests', error.message);
  }
};

/**
 * Get single feature request (admin)
 * @route GET /api/web/feature-requests/:id
 */
export const getSingleFeatureRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await FeatureRequest.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate('requestedBundleId', 'name featureKey price durationInDays includedFeatures')
      .populate('reviewedBy', 'name username')
      .populate('couponId', 'code discountPercent maxDiscountAmount')
      .populate('existingUserId', 'name phone')
      .populate('userFeatureAccessIds');

    if (!request) {
      return responseUtil.notFound(res, 'Feature request not found');
    }

    return responseUtil.success(res, 'Feature request fetched successfully', { request });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error fetching request:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch feature request', error.message);
  }
};

/**
 * Approve feature request and send payment link (admin)
 * @route POST /api/web/feature-requests/:id/approve
 */
export const approveFeatureRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { features, paymentAmount, durationInDays, adminNotes, sendWhatsApp = true, couponCode } = req.body;
    const adminId = req.user?._id;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[FEATURE-REQUEST-APPROVE] Starting approval process');
    console.log('[FEATURE-REQUEST-APPROVE] Request ID:', id);
    console.log('[FEATURE-REQUEST-APPROVE] Features to approve:', features);
    console.log('[FEATURE-REQUEST-APPROVE] Duration (days):', durationInDays);
    console.log('[FEATURE-REQUEST-APPROVE] Payment Amount (override):', paymentAmount);
    console.log('[FEATURE-REQUEST-APPROVE] Coupon Code:', couponCode || 'None');
    console.log('[FEATURE-REQUEST-APPROVE] Send WhatsApp:', sendWhatsApp);
    console.log('═══════════════════════════════════════════════════════════');

    // Validate request exists and is pending
    const request = await FeatureRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Feature request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot approve request with status: ${request.status}. Only PENDING requests can be approved.`
      );
    }

    // Determine features to grant (use provided features or default to requested)
    const approvedFeatures = features && features.length > 0
      ? features.map(f => f.toUpperCase())
      : request.requestedFeatures.map(f => f.featureKey);

    // Validate features
    const validFeatures = ['SOS', 'CONNECT', 'CHALLENGE'];
    const invalidFeatures = approvedFeatures.filter(f => !validFeatures.includes(f));
    if (invalidFeatures.length > 0) {
      return responseUtil.badRequest(res, `Invalid features: ${invalidFeatures.join(', ')}`);
    }

    // Calculate pricing
    let originalAmount = 0;
    let featureNames = [];
    for (const featureKey of approvedFeatures) {
      const pricing = await FeaturePricing.findByFeatureKey(featureKey);
      if (pricing) {
        originalAmount += pricing.price;
        featureNames.push(pricing.name);
      } else {
        featureNames.push(featureKey);
      }
    }

    // Determine duration
    const duration = durationInDays !== undefined ? durationInDays : 30; // Default 30 days

    // Process coupon
    let discountAmount = 0;
    let discountPercent = 0;
    let finalAmount = originalAmount;
    let appliedCouponId = null;
    let appliedCouponCode = null;

    if (couponCode) {
      console.log('[FEATURE-REQUEST-APPROVE] Validating coupon:', couponCode);

      const couponValidation = await validateCouponForType(
        couponCode,
        originalAmount,
        request.phone,
        'FEATURE'
      );

      if (!couponValidation.isValid) {
        return responseUtil.badRequest(res, `Coupon error: ${couponValidation.error}`);
      }

      discountAmount = couponValidation.discountAmount;
      discountPercent = couponValidation.coupon.discountPercent;
      finalAmount = couponValidation.finalAmount;
      appliedCouponId = couponValidation.coupon._id;
      appliedCouponCode = couponValidation.coupon.code;

      console.log('[FEATURE-REQUEST-APPROVE] Coupon applied:', appliedCouponCode, 'Discount:', discountAmount);
    }

    // If admin provided custom payment amount, use that
    let amount = finalAmount;
    if (paymentAmount !== undefined && paymentAmount !== null) {
      console.log('[FEATURE-REQUEST-APPROVE] Admin provided custom payment amount:', paymentAmount);
      amount = paymentAmount;
      discountAmount = originalAmount - amount;
      if (discountAmount < 0) discountAmount = 0;
    }

    if (amount < 0) {
      return responseUtil.badRequest(res, 'Payment amount cannot be negative');
    }

    // Generate order ID
    const orderId = `FR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[FEATURE-REQUEST-APPROVE] Generated Order ID:', orderId);

    // Create Razorpay payment link
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const featureDescription = approvedFeatures.length === 1
      ? `${approvedFeatures[0]} Tab Access`
      : `Feature Access: ${approvedFeatures.join(' + ')}`;

    const paymentLinkOptions = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      accept_partial: false,
      description: featureDescription,
      customer: {
        name: request.name,
        contact: `91${request.phone}`,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: orderId,
        type: 'FEATURE_REQUEST',
        phone: request.phone,
        requestId: request._id.toString(),
        features: approvedFeatures.join(','),
        durationInDays: duration.toString(),
      },
      callback_url: `${process.env.BASE_URL || 'https://motivata.in'}/feature-payment-success`,
      callback_method: 'get',
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId,
    };

    console.log('[FEATURE-REQUEST-APPROVE] Creating Razorpay payment link...');

    let paymentLink;
    try {
      paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);
      console.log('[RAZORPAY] Payment link created:', paymentLink.short_url);
    } catch (razorpayError) {
      console.error('[RAZORPAY] Failed to create payment link:', razorpayError.message);
      throw razorpayError;
    }

    // Create Payment record
    const payment = new Payment({
      orderId: orderId,
      type: 'FEATURE_REQUEST',
      phone: request.phone,
      userId: request.existingUserId || null,
      amount: originalAmount,
      couponCode: appliedCouponCode,
      discountAmount: discountAmount,
      finalAmount: amount,
      status: 'PENDING',
      metadata: {
        featureRequestId: request._id.toString(),
        features: approvedFeatures,
        durationInDays: duration,
        paymentLinkId: paymentLink.id,
        source: 'FEATURE_REQUEST',
        couponId: appliedCouponId?.toString() || null,
      },
    });

    await payment.save();
    console.log('[FEATURE-REQUEST-APPROVE] Payment record created:', payment._id);

    // Update request
    const couponInfo = appliedCouponCode ? {
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      originalAmount: originalAmount,
    } : null;

    request.status = 'PAYMENT_SENT';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.approvedFeatures = approvedFeatures;
    request.originalAmount = originalAmount;
    request.paymentAmount = amount;
    request.durationInDays = duration;
    request.couponId = appliedCouponId;
    request.couponCode = appliedCouponCode;
    request.discountPercent = discountPercent;
    request.discountAmount = discountAmount;
    request.adminNotes = adminNotes || null;
    request.paymentLinkId = paymentLink.id;
    request.paymentUrl = paymentLink.short_url;
    request.orderId = orderId;

    await request.save();
    console.log('[FEATURE-REQUEST-APPROVE] Request updated to PAYMENT_SENT');

    // Send WhatsApp
    let whatsappSent = false;
    if (sendWhatsApp) {
      try {
        await sendServicePaymentLinkWhatsApp({
          phone: request.phone,
          serviceName: featureDescription,
          paymentLink: paymentLink.short_url,
          amount: amount,
          serviceOrderId: request._id.toString(),
        });
        whatsappSent = true;
        console.log('[FEATURE-REQUEST-APPROVE] WhatsApp sent successfully');
      } catch (whatsappError) {
        console.error('[FEATURE-REQUEST-APPROVE] WhatsApp failed:', whatsappError.message);
      }
    }

    // Populate and return
    const populatedRequest = await FeatureRequest.findById(request._id)
      .populate('reviewedBy', 'name username')
      .populate('couponId', 'code discountPercent');

    console.log('[FEATURE-REQUEST-APPROVE] Approval completed successfully');
    console.log('═══════════════════════════════════════════════════════════');

    return responseUtil.success(res, 'Feature request approved. Payment link sent.', {
      request: populatedRequest,
      paymentLink: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      whatsappSent,
      pricing: {
        originalAmount,
        couponCode: appliedCouponCode,
        discountPercent,
        discountAmount,
        finalAmount: amount,
      },
    });
  } catch (error) {
    console.error('[FEATURE-REQUEST-APPROVE] Error:', error.message);
    return responseUtil.internalError(res, 'Failed to approve feature request', error.message);
  }
};

/**
 * Reject feature request (admin)
 * @route POST /api/web/feature-requests/:id/reject
 */
export const rejectFeatureRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user?._id;

    console.log('[FEATURE-REQUEST] Rejecting request:', id);

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return responseUtil.badRequest(res, 'Rejection reason is required.');
    }

    const request = await FeatureRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Feature request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot reject request with status: ${request.status}. Only PENDING requests can be rejected.`
      );
    }

    await request.reject(adminId, rejectionReason.trim(), adminNotes);

    const populatedRequest = await FeatureRequest.findById(request._id)
      .populate('reviewedBy', 'name username');

    console.log('[FEATURE-REQUEST] Request rejected:', id);

    return responseUtil.success(res, 'Feature request rejected.', { request: populatedRequest });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error rejecting request:', error.message);
    return responseUtil.internalError(res, 'Failed to reject feature request', error.message);
  }
};

/**
 * Resend payment link (admin)
 * @route POST /api/web/feature-requests/:id/resend-link
 */
export const resendPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[FEATURE-REQUEST] Resending payment link for:', id);

    const request = await FeatureRequest.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!request) {
      return responseUtil.notFound(res, 'Feature request not found');
    }

    if (request.status !== 'PAYMENT_SENT') {
      return responseUtil.badRequest(
        res,
        `Cannot resend link for request with status: ${request.status}. Only PAYMENT_SENT requests can have link resent.`
      );
    }

    if (!request.paymentUrl) {
      return responseUtil.badRequest(res, 'No payment link found for this request.');
    }

    // Build feature description
    const featureDescription = request.approvedFeatures.length === 1
      ? `${request.approvedFeatures[0]} Tab Access`
      : `Feature Access: ${request.approvedFeatures.join(' + ')}`;

    // Send WhatsApp
    try {
      await sendServicePaymentLinkWhatsApp({
        phone: request.phone,
        serviceName: featureDescription,
        paymentLink: request.paymentUrl,
        amount: request.paymentAmount,
        serviceOrderId: request._id.toString(),
      });

      console.log('[FEATURE-REQUEST] Payment link resent via WhatsApp');

      return responseUtil.success(res, 'Payment link resent successfully.', {
        requestId: request._id,
        paymentLink: request.paymentUrl,
      });
    } catch (whatsappError) {
      console.error('[FEATURE-REQUEST] Failed to resend WhatsApp:', whatsappError.message);
      return responseUtil.internalError(res, 'Failed to send WhatsApp. Payment link is still valid.', {
        paymentLink: request.paymentUrl,
      });
    }
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error resending link:', error.message);
    return responseUtil.internalError(res, 'Failed to resend payment link', error.message);
  }
};

/**
 * Get pending requests count (admin)
 * @route GET /api/web/feature-requests/pending-count
 */
export const getPendingCount = async (req, res) => {
  try {
    const count = await FeatureRequest.getPendingCount();
    return responseUtil.success(res, 'Pending count fetched', { count });
  } catch (error) {
    console.error('[FEATURE-REQUEST] Error fetching pending count:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch pending count', error.message);
  }
};

export default {
  getFeaturePricing,
  submitFeatureRequest,
  withdrawFeatureRequest,
  getAllFeatureRequests,
  getSingleFeatureRequest,
  approveFeatureRequest,
  rejectFeatureRequest,
  resendPaymentLink,
  getPendingCount,
};
