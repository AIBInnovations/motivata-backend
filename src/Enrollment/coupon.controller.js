/**
 * @fileoverview Coupon controller with CRUD and soft delete operations
 * @module controllers/coupon
 */

import Coupon from '../../schema/Coupon.schema.js';
import Payment from '../../schema/Payment.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create a new coupon (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with created coupon
 */
export const createCoupon = async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      createdBy: req.user.id
    };

    const coupon = new Coupon(couponData);
    await coupon.save();

    return responseUtil.created(res, 'Coupon created successfully', { coupon });
  } catch (error) {
    console.error('Create coupon error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'Coupon code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create coupon', error.message);
  }
};

/**
 * Get all coupons with pagination and filters (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated coupons
 */
export const getAllCoupons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive,
      search
    } = req.query;

    // Build query
    const query = {};

    if (typeof isActive !== 'undefined') {
      query.isActive = isActive;
    }

    // Search filter
    if (search) {
      query.$or = [
        { code: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [coupons, totalCount] = await Promise.all([
      Coupon.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      Coupon.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, 'Coupons retrieved successfully', {
      coupons,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve coupons', error.message);
  }
};

/**
 * Get active coupons (Public/User access)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with active coupons
 */
export const getActiveCoupons = async (req, res) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    })
    .select('code discountPercent maxDiscountAmount minPurchaseAmount description validFrom validUntil')
    .sort({ createdAt: -1 });

    return responseUtil.success(res, 'Active coupons retrieved successfully', { coupons });
  } catch (error) {
    console.error('Get active coupons error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve active coupons', error.message);
  }
};

/**
 * Get coupon by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with coupon details
 */
export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!coupon) {
      return responseUtil.notFound(res, 'Coupon not found');
    }

    return responseUtil.success(res, 'Coupon retrieved successfully', { coupon });
  } catch (error) {
    console.error('Get coupon by ID error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve coupon', error.message);
  }
};

/**
 * Validate coupon for a specific type (utility function for internal use)
 * @param {string} code - Coupon code
 * @param {number} amount - Purchase amount
 * @param {string} phone - User's phone number (normalized to 10 digits)
 * @param {string} type - Type of purchase: 'EVENT', 'MEMBERSHIP', 'SESSION'
 * @returns {Object} { isValid, coupon, discountAmount, finalAmount, error }
 */
export const validateCouponForType = async (code, amount, phone, type) => {
  const logPrefix = '[COUPON-VALIDATE]';
  const startTime = Date.now();

  console.log(`${logPrefix} ========== COUPON VALIDATION START ==========`);
  console.log(`${logPrefix} Input:`, {
    code: code?.toUpperCase() || 'N/A',
    amount,
    phone: phone ? `***${phone.slice(-4)}` : 'N/A',
    type
  });

  try {
    // Step 1: Check if code is provided
    if (!code) {
      console.log(`${logPrefix} [FAIL] No coupon code provided`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Coupon code is required' };
    }

    // Step 2: Find coupon in database
    console.log(`${logPrefix} [STEP 1] Searching for coupon: ${code.toUpperCase()}`);
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      console.log(`${logPrefix} [FAIL] Coupon not found in database`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Invalid coupon code' };
    }

    console.log(`${logPrefix} [STEP 1] Coupon found:`, {
      id: coupon._id,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minPurchaseAmount: coupon.minPurchaseAmount,
      applicableTo: coupon.applicableTo,
      usageCount: coupon.usageCount,
      maxUsageLimit: coupon.maxUsageLimit,
      maxUsagePerUser: coupon.maxUsagePerUser,
      isActive: coupon.isActive,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil
    });

    // Step 3: Check if coupon is active
    console.log(`${logPrefix} [STEP 2] Checking active status...`);
    if (!coupon.isActive) {
      console.log(`${logPrefix} [FAIL] Coupon is inactive`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Coupon is not active' };
    }
    console.log(`${logPrefix} [STEP 2] ✓ Coupon is active`);

    // Step 4: Check validity dates
    console.log(`${logPrefix} [STEP 3] Checking validity dates...`);
    const now = new Date();
    console.log(`${logPrefix} [STEP 3] Current time: ${now.toISOString()}`);
    console.log(`${logPrefix} [STEP 3] Valid from: ${coupon.validFrom.toISOString()}`);
    console.log(`${logPrefix} [STEP 3] Valid until: ${coupon.validUntil.toISOString()}`);

    if (now < coupon.validFrom) {
      const startsIn = Math.ceil((coupon.validFrom - now) / (1000 * 60 * 60 * 24));
      console.log(`${logPrefix} [FAIL] Coupon not yet valid. Starts in ${startsIn} day(s)`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Coupon is not yet valid' };
    }

    if (now > coupon.validUntil) {
      const expiredAgo = Math.ceil((now - coupon.validUntil) / (1000 * 60 * 60 * 24));
      console.log(`${logPrefix} [FAIL] Coupon expired ${expiredAgo} day(s) ago`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Coupon has expired' };
    }
    console.log(`${logPrefix} [STEP 3] ✓ Coupon is within validity period`);

    // Step 5: Check if coupon is applicable to this type
    console.log(`${logPrefix} [STEP 4] Checking applicability for type: ${type}...`);
    const applicableTypes = coupon.applicableTo || ['ALL'];
    console.log(`${logPrefix} [STEP 4] Coupon applicable to: ${applicableTypes.join(', ')}`);

    if (!applicableTypes.includes('ALL') && !applicableTypes.includes(type)) {
      console.log(`${logPrefix} [FAIL] Coupon not applicable for ${type}. Only valid for: ${applicableTypes.join(', ')}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: `This coupon is not valid for ${type.toLowerCase()} purchases` };
    }
    console.log(`${logPrefix} [STEP 4] ✓ Coupon is applicable for ${type}`);

    // Step 6: Check global usage limit
    console.log(`${logPrefix} [STEP 5] Checking global usage limit...`);
    console.log(`${logPrefix} [STEP 5] Current usage: ${coupon.usageCount}, Max limit: ${coupon.maxUsageLimit || 'Unlimited'}`);

    if (coupon.maxUsageLimit !== null && coupon.usageCount >= coupon.maxUsageLimit) {
      console.log(`${logPrefix} [FAIL] Global usage limit reached (${coupon.usageCount}/${coupon.maxUsageLimit})`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return { isValid: false, error: 'Coupon usage limit reached' };
    }
    console.log(`${logPrefix} [STEP 5] ✓ Global usage limit OK (${coupon.usageCount}/${coupon.maxUsageLimit || '∞'})`);

    // Step 7: Check minimum purchase amount
    console.log(`${logPrefix} [STEP 6] Checking minimum purchase amount...`);
    console.log(`${logPrefix} [STEP 6] Purchase amount: ₹${amount}, Minimum required: ₹${coupon.minPurchaseAmount}`);

    if (amount < coupon.minPurchaseAmount) {
      console.log(`${logPrefix} [FAIL] Purchase amount ₹${amount} is below minimum ₹${coupon.minPurchaseAmount}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return {
        isValid: false,
        error: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`
      };
    }
    console.log(`${logPrefix} [STEP 6] ✓ Minimum purchase amount satisfied`);

    // Step 8: Check user-specific usage by phone
    console.log(`${logPrefix} [STEP 7] Checking per-user usage limit...`);
    if (phone && coupon.maxUsagePerUser) {
      const normalizedPhone = phone.slice(-10);
      console.log(`${logPrefix} [STEP 7] Checking usage for phone: ***${normalizedPhone.slice(-4)}`);
      console.log(`${logPrefix} [STEP 7] Max usage per user: ${coupon.maxUsagePerUser}`);

      const userUsageCount = await Payment.countDocuments({
        phone: normalizedPhone,
        couponCode: coupon.code,
        status: 'SUCCESS'
      });

      console.log(`${logPrefix} [STEP 7] User's current usage: ${userUsageCount}`);

      if (userUsageCount >= coupon.maxUsagePerUser) {
        console.log(`${logPrefix} [FAIL] Per-user limit reached (${userUsageCount}/${coupon.maxUsagePerUser})`);
        console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
        return {
          isValid: false,
          error: 'You have reached the maximum usage limit for this coupon'
        };
      }
      console.log(`${logPrefix} [STEP 7] ✓ Per-user usage limit OK (${userUsageCount}/${coupon.maxUsagePerUser})`);
    } else {
      console.log(`${logPrefix} [STEP 7] ✓ No per-user limit check needed (phone: ${phone ? 'provided' : 'not provided'}, maxUsagePerUser: ${coupon.maxUsagePerUser || 'not set'})`);
    }

    // Step 9: Calculate discount
    console.log(`${logPrefix} [STEP 8] Calculating discount...`);
    const calculatedDiscount = (amount * coupon.discountPercent) / 100;
    const discountAmount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
    const finalAmount = Math.max(amount - discountAmount, 0);

    console.log(`${logPrefix} [STEP 8] Discount calculation:`, {
      originalAmount: amount,
      discountPercent: coupon.discountPercent,
      calculatedDiscount: calculatedDiscount.toFixed(2),
      maxDiscountCap: coupon.maxDiscountAmount,
      appliedDiscount: discountAmount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
      savingsPercent: ((discountAmount / amount) * 100).toFixed(1) + '%'
    });

    // Success
    console.log(`${logPrefix} [SUCCESS] ✓ Coupon validation passed`);
    console.log(`${logPrefix} Summary:`, {
      couponCode: coupon.code,
      originalAmount: `₹${amount}`,
      discount: `₹${discountAmount.toFixed(2)} (${coupon.discountPercent}%)`,
      finalAmount: `₹${finalAmount.toFixed(2)}`,
      savings: `₹${discountAmount.toFixed(2)}`
    });
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== COUPON VALIDATION END ==========`);

    return {
      isValid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        maxDiscountAmount: coupon.maxDiscountAmount,
        description: coupon.description,
        validUntil: coupon.validUntil
      },
      originalAmount: amount,
      discountAmount,
      finalAmount
    };
  } catch (error) {
    console.error(`${logPrefix} [ERROR] Exception during validation:`, error.message);
    console.error(`${logPrefix} [ERROR] Stack:`, error.stack);
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== COUPON VALIDATION END (ERROR) ==========`);
    return { isValid: false, error: 'Failed to validate coupon' };
  }
};

/**
 * Validate and get coupon discount
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with coupon validation and discount
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body;
    const userId = req.user?.id;

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return responseUtil.notFound(res, 'Invalid coupon code');
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return responseUtil.badRequest(res, 'Coupon is not active');
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validFrom) {
      return responseUtil.badRequest(res, 'Coupon is not yet valid');
    }

    if (now > coupon.validUntil) {
      return responseUtil.badRequest(res, 'Coupon has expired');
    }

    // Check usage limit
    if (coupon.maxUsageLimit !== null && coupon.usageCount >= coupon.maxUsageLimit) {
      return responseUtil.badRequest(res, 'Coupon usage limit reached');
    }

    // Check minimum purchase amount
    if (amount < coupon.minPurchaseAmount) {
      return responseUtil.badRequest(
        res,
        `Minimum purchase amount of �${coupon.minPurchaseAmount} required`
      );
    }

    // Check user-specific usage
    if (userId && coupon.maxUsagePerUser) {
      const userUsageCount = await Payment.countDocuments({
        userId,
        couponCode: coupon.code,
        status: 'SUCCESS'
      });

      if (userUsageCount >= coupon.maxUsagePerUser) {
        return responseUtil.badRequest(
          res,
          'You have reached the maximum usage limit for this coupon'
        );
      }
    }

    // Calculate discount
    const discountAmount = (amount * coupon.discountPercent) / 100;
    const finalDiscount = Math.min(discountAmount, coupon.maxDiscountAmount);
    const finalAmount = amount - finalDiscount;

    return responseUtil.success(res, 'Coupon is valid', {
      coupon: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        maxDiscountAmount: coupon.maxDiscountAmount
      },
      originalAmount: amount,
      discountAmount: finalDiscount,
      finalAmount
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return responseUtil.internalError(res, 'Failed to validate coupon', error.message);
  }
};

/**
 * Update coupon (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated coupon
 */
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[COUPON-UPDATE] Starting update for coupon ID:', id);
    console.log('[COUPON-UPDATE] Request body:', JSON.stringify(req.body, null, 2));

    // First fetch the existing coupon to merge values for cross-field validation
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return responseUtil.notFound(res, 'Coupon not found');
    }

    console.log('[COUPON-UPDATE] Existing coupon validFrom:', existingCoupon.validFrom);
    console.log('[COUPON-UPDATE] Existing coupon validUntil:', existingCoupon.validUntil);

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Cross-field validation for partial updates
    // Use existing values when the field is not being updated
    // Handle both Date objects and strings/numbers
    let finalValidFrom, finalValidUntil;

    if (updateData.validFrom !== undefined && updateData.validFrom !== null) {
      finalValidFrom = updateData.validFrom instanceof Date ? updateData.validFrom : new Date(updateData.validFrom);
    } else {
      finalValidFrom = existingCoupon.validFrom;
    }

    if (updateData.validUntil !== undefined && updateData.validUntil !== null) {
      finalValidUntil = updateData.validUntil instanceof Date ? updateData.validUntil : new Date(updateData.validUntil);
    } else {
      finalValidUntil = existingCoupon.validUntil;
    }

    console.log('[COUPON-UPDATE] Update data validFrom:', updateData.validFrom);
    console.log('[COUPON-UPDATE] Update data validUntil:', updateData.validUntil);
    console.log('[COUPON-UPDATE] Final validFrom (for comparison):', finalValidFrom);
    console.log('[COUPON-UPDATE] Final validUntil (for comparison):', finalValidUntil);
    console.log('[COUPON-UPDATE] Final validFrom timestamp:', finalValidFrom?.getTime());
    console.log('[COUPON-UPDATE] Final validUntil timestamp:', finalValidUntil?.getTime());
    console.log('[COUPON-UPDATE] Comparison result (validUntil <= validFrom):', finalValidUntil <= finalValidFrom);

    // Validate dates are valid Date objects
    if (!(finalValidFrom instanceof Date) || isNaN(finalValidFrom.getTime())) {
      console.log('[COUPON-UPDATE] Invalid validFrom date');
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'validFrom', message: 'Invalid date format for validFrom' }
      ]);
    }

    if (!(finalValidUntil instanceof Date) || isNaN(finalValidUntil.getTime())) {
      console.log('[COUPON-UPDATE] Invalid validUntil date');
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'validUntil', message: 'Invalid date format for validUntil' }
      ]);
    }

    // Validate validUntil > validFrom using timestamps to avoid any comparison issues
    if (finalValidUntil.getTime() <= finalValidFrom.getTime()) {
      console.log('[COUPON-UPDATE] Validation failed: validUntil must be after validFrom');
      console.log('[COUPON-UPDATE] validFrom timestamp:', finalValidFrom.getTime());
      console.log('[COUPON-UPDATE] validUntil timestamp:', finalValidUntil.getTime());
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'validUntil', message: 'Valid until date must be after valid from date' }
      ]);
    }

    console.log('[COUPON-UPDATE] Date validation passed, proceeding with update');

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('[COUPON-UPDATE] Coupon updated successfully');

    return responseUtil.success(res, 'Coupon updated successfully', { coupon });
  } catch (error) {
    console.error('[COUPON-UPDATE] Error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'Coupon code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to update coupon', error.message);
  }
};

/**
 * Soft delete coupon (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming deletion
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return responseUtil.notFound(res, 'Coupon not found');
    }

    await coupon.softDelete(req.user.id);

    return responseUtil.success(res, 'Coupon deleted successfully');
  } catch (error) {
    console.error('Delete coupon error:', error);
    return responseUtil.internalError(res, 'Failed to delete coupon', error.message);
  }
};

/**
 * Get deleted coupons (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with deleted coupons
 */
export const getDeletedCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.findDeleted()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('deletedBy', 'name email')
      .sort({ deletedAt: -1 });

    return responseUtil.success(res, 'Deleted coupons retrieved successfully', { coupons });
  } catch (error) {
    console.error('Get deleted coupons error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve deleted coupons', error.message);
  }
};

/**
 * Restore soft deleted coupon (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming restoration
 */
export const restoreCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findOne({ _id: id, isDeleted: true })
      .select('+isDeleted +deletedAt +deletedBy');

    if (!coupon) {
      return responseUtil.notFound(res, 'Deleted coupon not found');
    }

    await coupon.restore();

    return responseUtil.success(res, 'Coupon restored successfully', { coupon });
  } catch (error) {
    console.error('Restore coupon error:', error);
    return responseUtil.internalError(res, 'Failed to restore coupon', error.message);
  }
};

/**
 * Permanently delete coupon (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming permanent deletion
 */
export const permanentDeleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findOne({ _id: id, isDeleted: true })
      .select('+isDeleted');

    if (!coupon) {
      return responseUtil.notFound(res, 'Deleted coupon not found');
    }

    await Coupon.permanentDelete(id);

    return responseUtil.success(res, 'Coupon permanently deleted');
  } catch (error) {
    console.error('Permanent delete coupon error:', error);
    return responseUtil.internalError(res, 'Failed to permanently delete coupon', error.message);
  }
};

export default {
  createCoupon,
  getAllCoupons,
  getActiveCoupons,
  getCouponById,
  validateCoupon,
  validateCouponForType,
  updateCoupon,
  deleteCoupon,
  getDeletedCoupons,
  restoreCoupon,
  permanentDeleteCoupon
};
