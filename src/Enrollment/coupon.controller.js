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

    // First fetch the existing coupon to merge values for cross-field validation
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return responseUtil.notFound(res, 'Coupon not found');
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Cross-field validation for partial updates
    // Use existing values when the field is not being updated
    const finalValidFrom = updateData.validFrom ? new Date(updateData.validFrom) : existingCoupon.validFrom;
    const finalValidUntil = updateData.validUntil ? new Date(updateData.validUntil) : existingCoupon.validUntil;

    // Validate validUntil > validFrom
    if (finalValidUntil <= finalValidFrom) {
      return responseUtil.validationError(res, 'Validation failed', [
        { field: 'validUntil', message: 'Valid until date must be after valid from date' }
      ]);
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return responseUtil.success(res, 'Coupon updated successfully', { coupon });
  } catch (error) {
    console.error('Update coupon error:', error);

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
  updateCoupon,
  deleteCoupon,
  getDeletedCoupons,
  restoreCoupon,
  permanentDeleteCoupon
};
