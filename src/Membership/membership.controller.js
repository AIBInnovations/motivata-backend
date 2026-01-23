/**
 * @fileoverview Membership controller
 * Handles CRUD operations for membership plans and user memberships
 * @module controllers/membership
 */

import MembershipPlan from "../../schema/MembershipPlan.schema.js";
import UserMembership from "../../schema/UserMembership.schema.js";
import Payment from "../../schema/Payment.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";
import { razorpayInstance } from "../../utils/razorpay.util.js";
import { validateCouponForType } from "../Enrollment/coupon.controller.js";

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.slice(-10);
};

/**
 * MEMBERSHIP PLAN CONTROLLERS
 */

/**
 * Create new membership plan
 * Admin only
 * @route POST /api/admin/membership-plans
 */
export const createMembershipPlan = async (req, res) => {
  try {
    console.log("[MEMBERSHIP-PLAN] Creating new membership plan");
    console.log("[MEMBERSHIP-PLAN] Request body:", req.body);

    const {
      name,
      description,
      price,
      compareAtPrice,
      durationInDays,
      perks,
      metadata,
      displayOrder,
      isFeatured,
      isActive,
      maxPurchases,
    } = req.body;

    const userId = req.user?._id;

    const plan = new MembershipPlan({
      name,
      description,
      price,
      compareAtPrice,
      durationInDays,
      perks,
      metadata,
      displayOrder,
      isFeatured,
      isActive,
      maxPurchases,
      createdBy: userId,
    });

    await plan.save();

    console.log("[MEMBERSHIP-PLAN] Plan created successfully:", plan._id);

    return responseUtil.created(res, "Membership plan created successfully", {
      plan,
    });
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error creating plan:", error.message);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to create membership plan",
      error.message
    );
  }
};

/**
 * Get all membership plans
 * Public access (only active plans for users, all plans for admins)
 * @route GET /api/app/membership-plans
 * @route GET /api/admin/membership-plans
 */
export const getAllMembershipPlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "displayOrder",
      sortOrder = "asc",
      isActive,
      isFeatured,
      search,
    } = req.query;

    const isAdmin =
      req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";

    console.log(
      "[MEMBERSHIP-PLAN] Fetching plans - page:",
      page,
      "limit:",
      limit,
      "isAdmin:",
      isAdmin
    );

    const query = { isDeleted: false };

    if (!isAdmin) {
      query.isActive = true;
    } else if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [plans, totalCount] = await Promise.all([
      MembershipPlan.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "name username")
        .populate("updatedBy", "name username"),
      MembershipPlan.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log(
      "[MEMBERSHIP-PLAN] Found",
      plans.length,
      "plans out of",
      totalCount
    );

    return responseUtil.success(res, "Membership plans fetched successfully", {
      plans,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error fetching plans:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch membership plans",
      error.message
    );
  }
};

/**
 * Get single membership plan by ID
 * @route GET /api/app/membership-plans/:id
 * @route GET /api/admin/membership-plans/:id
 */
export const getMembershipPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[MEMBERSHIP-PLAN] Fetching plan:", id);

    const plan = await MembershipPlan.findOne({ _id: id, isDeleted: false })
      .populate("createdBy", "name username")
      .populate("updatedBy", "name username");

    if (!plan) {
      console.log("[MEMBERSHIP-PLAN] Plan not found:", id);
      return responseUtil.notFound(res, "Membership plan not found");
    }

    const isAdmin =
      req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
    if (!isAdmin && !plan.isActive) {
      return responseUtil.notFound(res, "Membership plan not found");
    }

    console.log("[MEMBERSHIP-PLAN] Plan found:", plan.name);

    return responseUtil.success(res, "Membership plan fetched successfully", {
      plan,
    });
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error fetching plan:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid plan ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch membership plan",
      error.message
    );
  }
};

/**
 * Update membership plan
 * Admin only
 * @route PUT /api/admin/membership-plans/:id
 */
export const updateMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    console.log("[MEMBERSHIP-PLAN] Updating plan:", id);

    const plan = await MembershipPlan.findOne({ _id: id, isDeleted: false });

    if (!plan) {
      console.log("[MEMBERSHIP-PLAN] Plan not found:", id);
      return responseUtil.notFound(res, "Membership plan not found");
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "compareAtPrice",
      "durationInDays",
      "perks",
      "metadata",
      "displayOrder",
      "isFeatured",
      "isActive",
      "maxPurchases",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });

    plan.updatedBy = userId;
    await plan.save();

    console.log("[MEMBERSHIP-PLAN] Plan updated successfully:", id);

    return responseUtil.success(res, "Membership plan updated successfully", {
      plan,
    });
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error updating plan:", error.message);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid plan ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to update membership plan",
      error.message
    );
  }
};

/**
 * Delete membership plan (soft delete)
 * Admin only
 * @route DELETE /api/admin/membership-plans/:id
 */
export const deleteMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    console.log("[MEMBERSHIP-PLAN] Deleting plan:", id);

    const plan = await MembershipPlan.findOne({ _id: id, isDeleted: false });

    if (!plan) {
      console.log("[MEMBERSHIP-PLAN] Plan not found:", id);
      return responseUtil.notFound(res, "Membership plan not found");
    }

    await plan.softDelete(userId);

    console.log("[MEMBERSHIP-PLAN] Plan deleted successfully:", id);

    return responseUtil.success(res, "Membership plan deleted successfully");
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error deleting plan:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid plan ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to delete membership plan",
      error.message
    );
  }
};

/**
 * Restore deleted membership plan
 * Admin only
 * @route POST /api/admin/membership-plans/:id/restore
 */
export const restoreMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[MEMBERSHIP-PLAN] Restoring plan:", id);

    const plan = await MembershipPlan.findOne({ _id: id, isDeleted: true });

    if (!plan) {
      console.log("[MEMBERSHIP-PLAN] Deleted plan not found:", id);
      return responseUtil.notFound(res, "Deleted membership plan not found");
    }

    await plan.restore();

    console.log("[MEMBERSHIP-PLAN] Plan restored successfully:", id);

    return responseUtil.success(res, "Membership plan restored successfully", {
      plan,
    });
  } catch (error) {
    console.error("[MEMBERSHIP-PLAN] Error restoring plan:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid plan ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to restore membership plan",
      error.message
    );
  }
};

/**
 * USER MEMBERSHIP CONTROLLERS
 */

/**
 * Create user membership (admin purchase - offline/manual)
 * Admin only
 * @route POST /api/admin/user-memberships
 */
export const createUserMembershipAdmin = async (req, res) => {
  try {
    const { phone, membershipPlanId, amountPaid, adminNotes } = req.body;
    const userId = req.user?._id;

    const normalizedPhone = normalizePhone(phone);

    console.log(
      "[USER-MEMBERSHIP] Creating admin membership for phone:",
      normalizedPhone
    );

    const plan = await MembershipPlan.findOne({
      _id: membershipPlanId,
      isDeleted: false,
    });

    if (!plan) {
      console.log("[USER-MEMBERSHIP] Plan not found:", membershipPlanId);
      return responseUtil.notFound(res, "Membership plan not found");
    }

    const canPurchase = plan.canBePurchased();
    if (!canPurchase.canPurchase) {
      console.log(
        "[USER-MEMBERSHIP] Plan cannot be purchased:",
        canPurchase.reason
      );
      return responseUtil.badRequest(res, canPurchase.reason);
    }

    const user = await User.findOne({
      phone: normalizedPhone,
      isDeleted: false,
    });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationInDays);

    const orderId = `ADMIN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const userMembership = new UserMembership({
      phone: normalizedPhone,
      userId: user?._id,
      membershipPlanId: plan._id,
      orderId,
      purchaseMethod: "ADMIN",
      amountPaid: amountPaid !== undefined ? amountPaid : plan.price,
      startDate,
      endDate,
      status: "ACTIVE",
      paymentStatus: "SUCCESS",
      planSnapshot: {
        name: plan.name,
        description: plan.description,
        durationInDays: plan.durationInDays,
        perks: plan.perks,
        metadata: plan.metadata,
      },
      adminNotes,
      createdBy: userId,
    });

    await userMembership.save();

    await plan.incrementPurchaseCount();

    console.log(
      "[USER-MEMBERSHIP] Admin membership created successfully:",
      userMembership._id
    );

    const populatedMembership = await UserMembership.findById(
      userMembership._id
    )
      .populate("membershipPlanId")
      .populate("userId", "name email phone")
      .populate("createdBy", "name username");

    return responseUtil.created(res, "User membership created successfully", {
      membership: populatedMembership,
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error creating admin membership:",
      error.message
    );

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "Duplicate order ID");
    }

    return responseUtil.internalError(
      res,
      "Failed to create user membership",
      error.message
    );
  }
};

/**
 * Create payment order for membership (in-app/website purchase)
 * User access
 * @route POST /api/app/memberships/create-order
 */
export const createMembershipPaymentOrder = async (req, res) => {
  const logPrefix = "[MEMBERSHIP-ORDER]";
  const startTime = Date.now();
  const requestId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`${logPrefix} ========== CREATE ORDER REQUEST START ==========`);
  console.log(`${logPrefix} Request ID: ${requestId}`);
  console.log(`${logPrefix} Timestamp: ${new Date().toISOString()}`);

  try {
    const { phone, membershipPlanId, couponCode } = req.body;
    const userId = req.user?._id;
    const normalizedPhone = normalizePhone(phone);

    console.log(`${logPrefix} Request details:`, {
      phone: normalizedPhone ? `***${normalizedPhone.slice(-4)}` : 'N/A',
      membershipPlanId,
      couponCode: couponCode?.toUpperCase() || 'None',
      userId: userId || 'Guest',
      ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown'
    });

    // Step 1: Fetch and validate plan
    console.log(`${logPrefix} [STEP 1] Fetching membership plan...`);
    const plan = await MembershipPlan.findOne({
      _id: membershipPlanId,
      isDeleted: false,
      isActive: true,
    });

    if (!plan) {
      console.log(`${logPrefix} [STEP 1] [FAIL] Plan not found or inactive: ${membershipPlanId}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      console.log(`${logPrefix} ========== CREATE ORDER REQUEST END (FAILED) ==========`);
      return responseUtil.notFound(res, "Membership plan not found or inactive");
    }

    console.log(`${logPrefix} [STEP 1] Plan found:`, {
      planId: plan._id,
      planName: plan.name,
      price: `₹${plan.price}`,
      durationInDays: plan.durationInDays,
      isLifetime: plan.isLifetime
    });

    // Step 2: Check if plan can be purchased
    console.log(`${logPrefix} [STEP 2] Checking plan availability...`);
    const canPurchase = plan.canBePurchased();
    if (!canPurchase.canPurchase) {
      console.log(`${logPrefix} [STEP 2] [FAIL] Plan unavailable: ${canPurchase.reason}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      console.log(`${logPrefix} ========== CREATE ORDER REQUEST END (FAILED) ==========`);
      return responseUtil.badRequest(res, canPurchase.reason);
    }
    console.log(`${logPrefix} [STEP 2] ✓ Plan is available for purchase`);

    // Step 3: Process coupon (if provided)
    const originalAmount = plan.price;
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let appliedCouponCode = null;
    let couponDetails = null;

    if (couponCode) {
      console.log(`${logPrefix} [STEP 3] ========== COUPON PROCESSING START ==========`);
      console.log(`${logPrefix} [STEP 3] Coupon code provided: ${couponCode.toUpperCase()}`);
      console.log(`${logPrefix} [STEP 3] Calling coupon validation service...`);

      const couponValidation = await validateCouponForType(
        couponCode,
        originalAmount,
        normalizedPhone,
        "MEMBERSHIP"
      );

      if (!couponValidation.isValid) {
        console.log(`${logPrefix} [STEP 3] [FAIL] Coupon validation failed`);
        console.log(`${logPrefix} [STEP 3] Reason: ${couponValidation.error}`);
        console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
        console.log(`${logPrefix} ========== CREATE ORDER REQUEST END (COUPON FAILED) ==========`);
        return responseUtil.badRequest(res, couponValidation.error);
      }

      // Coupon is valid - apply discount
      discountAmount = couponValidation.discountAmount;
      finalAmount = couponValidation.finalAmount;
      appliedCouponCode = couponValidation.coupon.code;
      couponDetails = couponValidation.coupon;

      console.log(`${logPrefix} [STEP 3] ✓ Coupon validated and applied successfully`);
      console.log(`${logPrefix} [STEP 3] Discount summary:`, {
        couponCode: appliedCouponCode,
        discountPercent: `${couponDetails.discountPercent}%`,
        originalAmount: `₹${originalAmount}`,
        discountAmount: `₹${discountAmount}`,
        finalAmount: `₹${finalAmount}`,
        savings: `₹${discountAmount} (${((discountAmount/originalAmount)*100).toFixed(1)}%)`
      });
      console.log(`${logPrefix} [STEP 3] ========== COUPON PROCESSING END ==========`);
    } else {
      console.log(`${logPrefix} [STEP 3] No coupon code provided - proceeding with full price: ₹${originalAmount}`);
    }

    // Step 4: Create Razorpay order
    console.log(`${logPrefix} [STEP 4] Creating Razorpay order...`);
    console.log(`${logPrefix} [STEP 4] Amount to charge: ₹${finalAmount} (${Math.round(finalAmount * 100)} paise)`);

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `membership_${Date.now()}`,
      notes: {
        type: "MEMBERSHIP",
        phone: normalizedPhone,
        membershipPlanId: membershipPlanId.toString(),
        couponCode: appliedCouponCode || "",
      },
    });

    console.log(`${logPrefix} [STEP 4] ✓ Razorpay order created:`, {
      orderId: razorpayOrder.id,
      amount: `₹${razorpayOrder.amount / 100}`,
      currency: razorpayOrder.currency,
      status: razorpayOrder.status
    });

    // Step 5: Find or identify user
    console.log(`${logPrefix} [STEP 5] Looking up user by phone...`);
    const user = await User.findOne({
      phone: normalizedPhone,
      isDeleted: false,
    });
    console.log(`${logPrefix} [STEP 5] User: ${user ? `Found (${user._id})` : 'Guest/Not found'}`);

    // Step 6: Create UserMembership record
    console.log(`${logPrefix} [STEP 6] Creating UserMembership record...`);
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationInDays);

    const userMembership = new UserMembership({
      phone: normalizedPhone,
      userId: user?._id || userId,
      membershipPlanId: plan._id,
      orderId: razorpayOrder.id,
      purchaseMethod: "IN_APP",
      amountPaid: finalAmount,
      startDate,
      endDate,
      status: "ACTIVE",
      paymentStatus: "PENDING",
      planSnapshot: {
        name: plan.name,
        description: plan.description,
        durationInDays: plan.durationInDays,
        perks: plan.perks,
        metadata: plan.metadata,
      },
      metadata: {
        razorpayOrderId: razorpayOrder.id,
        couponCode: appliedCouponCode,
        originalAmount,
        discountAmount,
      },
      createdBy: userId,
    });

    await userMembership.save();
    console.log(`${logPrefix} [STEP 6] ✓ UserMembership created: ${userMembership._id}`);

    // Step 7: Create Payment record
    console.log(`${logPrefix} [STEP 7] Creating Payment record...`);
    const payment = new Payment({
      type: "MEMBERSHIP",
      orderId: razorpayOrder.id,
      phone: normalizedPhone,
      amount: originalAmount,
      couponCode: appliedCouponCode,
      discountAmount,
      finalAmount,
      status: "PENDING",
      paymentMethod: "RAZORPAY",
      metadata: {
        phone: normalizedPhone,
        membershipPlanId: membershipPlanId.toString(),
        userMembershipId: userMembership._id.toString(),
        planName: plan.name,
        durationInDays: plan.durationInDays,
      },
    });

    await payment.save();
    console.log(`${logPrefix} [STEP 7] ✓ Payment record created: ${payment._id}`);

    // Success summary
    console.log(`${logPrefix} ========== ORDER CREATION SUMMARY ==========`);
    console.log(`${logPrefix} Request ID: ${requestId}`);
    console.log(`${logPrefix} Razorpay Order ID: ${razorpayOrder.id}`);
    console.log(`${logPrefix} UserMembership ID: ${userMembership._id}`);
    console.log(`${logPrefix} Payment ID: ${payment._id}`);
    console.log(`${logPrefix} Plan: ${plan.name} (${plan.durationInDays} days)`);
    console.log(`${logPrefix} Pricing:`, {
      originalPrice: `₹${originalAmount}`,
      couponApplied: appliedCouponCode || 'None',
      discount: `₹${discountAmount}`,
      finalAmount: `₹${finalAmount}`
    });
    console.log(`${logPrefix} Status: PENDING (awaiting payment)`);
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== CREATE ORDER REQUEST END (SUCCESS) ==========`);

    return responseUtil.created(
      res,
      "Membership payment order created successfully",
      {
        orderId: razorpayOrder.id,
        amount: originalAmount,
        discountAmount,
        finalAmount,
        couponApplied: appliedCouponCode,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        membership: {
          planName: plan.name,
          durationInDays: plan.durationInDays,
          perks: plan.perks,
        },
      }
    );
  } catch (error) {
    console.error(`${logPrefix} [ERROR] Exception during order creation`);
    console.error(`${logPrefix} [ERROR] Message: ${error.message}`);
    console.error(`${logPrefix} [ERROR] Stack: ${error.stack}`);
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== CREATE ORDER REQUEST END (ERROR) ==========`);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to create membership order",
      error.message
    );
  }
};

/**
 * Get all user memberships
 * Admin access with filters
 * @route GET /api/admin/user-memberships
 */
export const getAllUserMemberships = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      paymentStatus,
      purchaseMethod,
      membershipPlanId,
      phone,
      search,
    } = req.query;

    console.log(
      "[USER-MEMBERSHIP] Fetching memberships - page:",
      page,
      "limit:",
      limit
    );

    const query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (purchaseMethod) {
      query.purchaseMethod = purchaseMethod;
    }

    if (membershipPlanId) {
      query.membershipPlanId = membershipPlanId;
    }

    if (phone) {
      query.phone = normalizePhone(phone);
    }

    if (search) {
      const normalizedSearch = normalizePhone(search);
      query.phone = { $regex: normalizedSearch, $options: "i" };
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [memberships, totalCount] = await Promise.all([
      UserMembership.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("membershipPlanId")
        .populate("userId", "name email phone")
        .populate("createdBy", "name username")
        .populate("updatedBy", "name username"),
      UserMembership.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log(
      "[USER-MEMBERSHIP] Found",
      memberships.length,
      "memberships out of",
      totalCount
    );

    return responseUtil.success(res, "User memberships fetched successfully", {
      memberships,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error fetching memberships:",
      error.message
    );
    return responseUtil.internalError(
      res,
      "Failed to fetch user memberships",
      error.message
    );
  }
};

/**
 * Get user's own memberships
 * User access
 * @route GET /api/app/memberships/my-memberships
 */
export const getMyMemberships = async (req, res) => {
  try {
    console.log("[USER-MEMBERSHIP] Request received");
    console.log("[USER-MEMBERSHIP] req.body:", JSON.stringify(req.body));
    console.log("[USER-MEMBERSHIP] req.query:", JSON.stringify(req.query));
    console.log(
      "[USER-MEMBERSHIP] req.user:",
      JSON.stringify({
        _id: req.user?._id,
        phone: req.user?.phone,
        name: req.user?.name,
        email: req.user?.email,
      })
    );

    const userId = req.user?._id;
    let userPhone = req.user?.phone;

    if (!userPhone) {
      console.log(
        "[USER-MEMBERSHIP] Phone not in req.user, fetching from database"
      );
      console.log("[USER-MEMBERSHIP] User ID:", userId);
      console.log("[USER-MEMBERSHIP] User ID type:", typeof userId);

      const user = await User.findOne({ _id: userId, isDeleted: false });

      console.log("[USER-MEMBERSHIP] User found:", user ? "yes" : "no");
      if (user) {
        console.log("[USER-MEMBERSHIP] User phone from DB:", user.phone);
        console.log(
          "[USER-MEMBERSHIP] Full user object:",
          JSON.stringify({
            _id: user._id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            isDeleted: user.isDeleted,
          })
        );
      }

      if (!user || !user.phone) {
        console.log("[USER-MEMBERSHIP] User or phone not found in database");
        return responseUtil.badRequest(res, "User phone not found");
      }
      userPhone = user.phone;
    }

    const normalizedPhone = normalizePhone(userPhone);

    console.log(
      "[USER-MEMBERSHIP] Fetching memberships for phone:",
      normalizedPhone
    );

    const memberships = await UserMembership.findByPhone(
      normalizedPhone,
      false
    );

    const enrichedMemberships = memberships.map((membership) => {
      const currentStatus = membership.getCurrentStatus();
      return {
        ...membership.toObject(),
        currentStatus,
        isCurrentlyActive: membership.isCurrentlyActive,
        daysRemaining: membership.daysRemaining,
      };
    });

    console.log(
      "[USER-MEMBERSHIP] Found",
      enrichedMemberships.length,
      "memberships"
    );

    return responseUtil.success(res, "Your memberships fetched successfully", {
      memberships: enrichedMemberships,
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error fetching user memberships:",
      error.message
    );
    console.error("[USER-MEMBERSHIP] Error stack:", error.stack);
    return responseUtil.internalError(
      res,
      "Failed to fetch your memberships",
      error.message
    );
  }
};

/**
 * Check membership status by phone
 * User/Admin access
 * @route POST /api/app/memberships/check-status
 * @route POST /api/admin/user-memberships/check-status
 */
export const checkMembershipStatus = async (req, res) => {
  try {
    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);

    console.log(
      "[USER-MEMBERSHIP] Checking membership status for phone:",
      normalizedPhone
    );

    const activeMembership = await UserMembership.findActiveMembership(
      normalizedPhone
    );

    if (!activeMembership) {
      console.log("[USER-MEMBERSHIP] No active membership found");
      return responseUtil.success(res, "No active membership", {
        hasActiveMembership: false,
        membership: null,
      });
    }

    console.log(
      "[USER-MEMBERSHIP] Active membership found:",
      activeMembership._id
    );

    return responseUtil.success(res, "Active membership found", {
      hasActiveMembership: true,
      membership: {
        ...activeMembership.toObject(),
        currentStatus: activeMembership.getCurrentStatus(),
        daysRemaining: activeMembership.daysRemaining,
      },
    });
  } catch (error) {
    console.error("[USER-MEMBERSHIP] Error checking status:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to check membership status",
      error.message
    );
  }
};

/**
 * Check active membership by phone or user ID
 * User access - checks using either phone number or user ID
 * @route POST /api/app/memberships/check-active
 */
export const checkActiveMembership = async (req, res) => {
  try {
    const { phone, userId } = req.body;

    // console.log('[CHECK-ACTIVE-MEMBERSHIP] Request received');
    // console.log('[CHECK-ACTIVE-MEMBERSHIP] Phone:', phone);
    // console.log('[CHECK-ACTIVE-MEMBERSHIP] User ID:', userId);

    if (!phone && !userId) {
      // console.log('[CHECK-ACTIVE-MEMBERSHIP] Neither phone nor userId provided');
      return responseUtil.badRequest(
        res,
        "Phone number or user ID is required"
      );
    }

    const now = new Date();
    const query = {
      isDeleted: false,
      status: "ACTIVE",
      paymentStatus: "SUCCESS",
      startDate: { $lte: now },
      endDate: { $gt: now },
    };

    if (phone && userId) {
      const normalizedPhone = normalizePhone(phone);
      query.$or = [{ phone: normalizedPhone }, { userId: userId }];
      // console.log('[CHECK-ACTIVE-MEMBERSHIP] Checking with both phone and userId');
    } else if (phone) {
      const normalizedPhone = normalizePhone(phone);
      query.phone = normalizedPhone;
      // console.log('[CHECK-ACTIVE-MEMBERSHIP] Checking with phone:', normalizedPhone);
    } else {
      query.userId = userId;
      // console.log('[CHECK-ACTIVE-MEMBERSHIP] Checking with userId');
    }

    const activeMembership = await UserMembership.findOne(query)
      .sort({ endDate: -1 })
      .populate("membershipPlanId");

    if (!activeMembership) {
      console.log("[CHECK-ACTIVE-MEMBERSHIP] No active membership found");
      return responseUtil.success(res, "No active membership", {
        hasActiveMembership: false,
        membership: null,
      });
    }

    // console.log('[CHECK-ACTIVE-MEMBERSHIP] Active membership found:', activeMembership._id);

    const enrichedMembership = {
      ...activeMembership.toObject(),
      currentStatus: activeMembership.getCurrentStatus(),
      isCurrentlyActive: activeMembership.isCurrentlyActive,
      daysRemaining: activeMembership.daysRemaining,
    };

    return responseUtil.success(res, "Active membership found", {
      hasActiveMembership: true,
      membership: enrichedMembership,
    });
  } catch (error) {
    // console.error('[CHECK-ACTIVE-MEMBERSHIP] Error:', error.message);
    // console.error('[CHECK-ACTIVE-MEMBERSHIP] Error stack:', error.stack);
    return responseUtil.internalError(
      res,
      "Failed to check active membership",
      error.message
    );
  }
};

/**
 * Get user membership by ID
 * Admin access
 * @route GET /api/admin/user-memberships/:id
 */
export const getUserMembershipById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[USER-MEMBERSHIP] Fetching membership:", id);

    const membership = await UserMembership.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("membershipPlanId")
      .populate("userId", "name email phone")
      .populate("createdBy", "name username")
      .populate("updatedBy", "name username")
      .populate("cancelledBy", "name username");

    if (!membership) {
      console.log("[USER-MEMBERSHIP] Membership not found:", id);
      return responseUtil.notFound(res, "User membership not found");
    }

    const enrichedMembership = {
      ...membership.toObject(),
      currentStatus: membership.getCurrentStatus(),
      isCurrentlyActive: membership.isCurrentlyActive,
      daysRemaining: membership.daysRemaining,
    };

    console.log("[USER-MEMBERSHIP] Membership found");

    return responseUtil.success(res, "User membership fetched successfully", {
      membership: enrichedMembership,
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error fetching membership:",
      error.message
    );

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid membership ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch user membership",
      error.message
    );
  }
};

/**
 * Extend user membership duration
 * Admin only
 * @route POST /api/admin/user-memberships/:id/extend
 */
export const extendUserMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const { additionalDays } = req.body;
    const userId = req.user?._id;

    console.log(
      "[USER-MEMBERSHIP] Extending membership:",
      id,
      "by",
      additionalDays,
      "days"
    );

    const membership = await UserMembership.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!membership) {
      console.log("[USER-MEMBERSHIP] Membership not found:", id);
      return responseUtil.notFound(res, "User membership not found");
    }

    if (membership.status === "REFUNDED" || membership.status === "CANCELLED") {
      console.log(
        "[USER-MEMBERSHIP] Cannot extend cancelled/refunded membership"
      );
      return responseUtil.badRequest(
        res,
        "Cannot extend cancelled or refunded membership"
      );
    }

    await membership.extend(additionalDays);
    membership.updatedBy = userId;
    await membership.save();

    const populatedMembership = await UserMembership.findById(id)
      .populate("membershipPlanId")
      .populate("userId", "name email phone");

    console.log("[USER-MEMBERSHIP] Membership extended successfully");

    return responseUtil.success(res, "Membership extended successfully", {
      membership: populatedMembership,
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error extending membership:",
      error.message
    );

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid membership ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to extend membership",
      error.message
    );
  }
};

/**
 * Cancel user membership
 * Admin only
 * @route POST /api/admin/user-memberships/:id/cancel
 */
export const cancelUserMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?._id;

    console.log("[USER-MEMBERSHIP] Cancelling membership:", id);

    const membership = await UserMembership.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!membership) {
      console.log("[USER-MEMBERSHIP] Membership not found:", id);
      return responseUtil.notFound(res, "User membership not found");
    }

    if (membership.status === "CANCELLED" || membership.status === "REFUNDED") {
      console.log("[USER-MEMBERSHIP] Membership already cancelled/refunded");
      return responseUtil.badRequest(
        res,
        "Membership already cancelled or refunded"
      );
    }

    await membership.cancel(userId, reason || "Cancelled by admin");

    const populatedMembership = await UserMembership.findById(id)
      .populate("membershipPlanId")
      .populate("userId", "name email phone")
      .populate("cancelledBy", "name username");

    console.log("[USER-MEMBERSHIP] Membership cancelled successfully");

    return responseUtil.success(res, "Membership cancelled successfully", {
      membership: populatedMembership,
    });
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error cancelling membership:",
      error.message
    );

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid membership ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to cancel membership",
      error.message
    );
  }
};

/**
 * Update admin notes
 * Admin only
 * @route PATCH /api/admin/user-memberships/:id/notes
 */
export const updateMembershipNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const userId = req.user?._id;

    console.log("[USER-MEMBERSHIP] Updating notes for membership:", id);

    const membership = await UserMembership.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!membership) {
      console.log("[USER-MEMBERSHIP] Membership not found:", id);
      return responseUtil.notFound(res, "User membership not found");
    }

    membership.adminNotes = adminNotes;
    membership.updatedBy = userId;
    await membership.save();

    console.log("[USER-MEMBERSHIP] Notes updated successfully");

    return responseUtil.success(res, "Admin notes updated successfully", {
      membership,
    });
  } catch (error) {
    console.error("[USER-MEMBERSHIP] Error updating notes:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid membership ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to update admin notes",
      error.message
    );
  }
};

/**
 * Delete user membership (soft delete)
 * Admin only
 * @route DELETE /api/admin/user-memberships/:id
 */
export const deleteUserMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    console.log("[USER-MEMBERSHIP] Deleting membership:", id);

    const membership = await UserMembership.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!membership) {
      console.log("[USER-MEMBERSHIP] Membership not found:", id);
      return responseUtil.notFound(res, "User membership not found");
    }

    await membership.softDelete(userId);

    console.log("[USER-MEMBERSHIP] Membership deleted successfully");

    return responseUtil.success(res, "User membership deleted successfully");
  } catch (error) {
    console.error(
      "[USER-MEMBERSHIP] Error deleting membership:",
      error.message
    );

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid membership ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to delete user membership",
      error.message
    );
  }
};

/**
 * Validate coupon for membership purchase
 * User access - allows users to preview discount before purchase
 * @route POST /api/app/memberships/validate-coupon
 */
export const validateMembershipCoupon = async (req, res) => {
  const logPrefix = "[MEMBERSHIP-COUPON-PREVIEW]";
  const startTime = Date.now();
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST START ==========`);
  console.log(`${logPrefix} Request ID: ${requestId}`);
  console.log(`${logPrefix} Timestamp: ${new Date().toISOString()}`);

  try {
    const { couponCode, membershipPlanId } = req.body;
    const userPhone = req.user?.phone || req.body.phone;
    const userId = req.user?._id;

    console.log(`${logPrefix} Request details:`, {
      couponCode: couponCode?.toUpperCase() || 'N/A',
      membershipPlanId,
      phone: userPhone ? `***${userPhone.slice(-4)}` : 'N/A',
      userId: userId || 'Guest',
      ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown'
    });

    // Validate input
    if (!couponCode) {
      console.log(`${logPrefix} [FAIL] Missing coupon code in request`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return responseUtil.badRequest(res, "Coupon code is required");
    }

    if (!membershipPlanId) {
      console.log(`${logPrefix} [FAIL] Missing membership plan ID in request`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return responseUtil.badRequest(res, "Membership plan ID is required");
    }

    // Get the membership plan
    console.log(`${logPrefix} Fetching membership plan: ${membershipPlanId}`);
    const plan = await MembershipPlan.findOne({
      _id: membershipPlanId,
      isDeleted: false,
      isActive: true,
    });

    if (!plan) {
      console.log(`${logPrefix} [FAIL] Membership plan not found or inactive: ${membershipPlanId}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return responseUtil.notFound(res, "Membership plan not found or inactive");
    }

    console.log(`${logPrefix} Plan found:`, {
      planId: plan._id,
      planName: plan.name,
      price: plan.price,
      durationInDays: plan.durationInDays
    });

    const normalizedPhone = userPhone ? normalizePhone(userPhone) : null;

    // Validate the coupon (this will log detailed validation steps)
    console.log(`${logPrefix} Calling coupon validation service...`);
    const validation = await validateCouponForType(
      couponCode,
      plan.price,
      normalizedPhone,
      "MEMBERSHIP"
    );

    if (!validation.isValid) {
      console.log(`${logPrefix} [RESULT] Coupon validation FAILED`);
      console.log(`${logPrefix} Reason: ${validation.error}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST END (FAILED) ==========`);
      return responseUtil.badRequest(res, validation.error);
    }

    // Success - prepare response
    const responseData = {
      isValid: true,
      originalAmount: plan.price,
      discountPercent: validation.coupon.discountPercent,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      coupon: {
        code: validation.coupon.code,
        description: validation.coupon.description,
        validUntil: validation.coupon.validUntil,
      },
      plan: {
        name: plan.name,
        price: plan.price,
      },
    };

    console.log(`${logPrefix} [RESULT] Coupon validation SUCCESSFUL`);
    console.log(`${logPrefix} Preview summary:`, {
      couponCode: validation.coupon.code,
      planName: plan.name,
      originalPrice: `₹${plan.price}`,
      discount: `₹${validation.discountAmount} (${validation.coupon.discountPercent}%)`,
      finalPrice: `₹${validation.finalAmount}`,
      userSaves: `₹${validation.discountAmount}`
    });
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST END (SUCCESS) ==========`);

    return responseUtil.success(res, "Coupon is valid", responseData);
  } catch (error) {
    console.error(`${logPrefix} [ERROR] Exception occurred:`, error.message);
    console.error(`${logPrefix} Stack trace:`, error.stack);
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST END (ERROR) ==========`);
    return responseUtil.internalError(
      res,
      "Failed to validate coupon",
      error.message
    );
  }
};

export default {
  createMembershipPlan,
  getAllMembershipPlans,
  getMembershipPlanById,
  updateMembershipPlan,
  deleteMembershipPlan,
  restoreMembershipPlan,
  createUserMembershipAdmin,
  createMembershipPaymentOrder,
  getAllUserMemberships,
  getMyMemberships,
  checkMembershipStatus,
  checkActiveMembership,
  getUserMembershipById,
  extendUserMembership,
  cancelUserMembership,
  updateMembershipNotes,
  deleteUserMembership,
  validateMembershipCoupon,
};
