/**
 * @fileoverview ReferralCode controller
 *
 * Referral codes verify that a buyer really is a student of a given college.
 * They are NOT coupons: they never change the price. They gate checkout on
 * plans flagged `requiresReferral`, and tag the resulting membership with the
 * college so the admin can report on it.
 *
 * usedCount only ever moves on payment success (razorpay webhook), never here
 * during validation — otherwise checking a code would consume it.
 *
 * @module controllers/referralCode
 */

import ReferralCode from '../../schema/ReferralCode.schema.js';
import College from '../../schema/College.schema.js';
import MembershipPlan from '../../schema/MembershipPlan.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create a referral code (admin). The college is chosen at creation time.
 * @route POST /api/web/referral-codes
 */
export const createReferralCode = async (req, res) => {
  try {
    const { collegeId } = req.body;

    // A code is meaningless without a live college behind it.
    const college = await College.findOne({ _id: collegeId, isDeleted: false });
    if (!college) {
      return responseUtil.badRequest(res, 'Selected college is not available');
    }

    const referralCode = new ReferralCode({
      ...req.body,
      createdBy: req.user?._id || req.user?.id,
    });

    await referralCode.save();
    await referralCode.populate('collegeId', 'name city isActive kind');

    console.log('[REFERRAL] Created:', referralCode.code, 'for', college.name);

    return responseUtil.created(res, 'Referral code created successfully', { referralCode });
  } catch (error) {
    console.error('[REFERRAL] Create error:', error.message);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'This referral code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create referral code', error.message);
  }
};

/**
 * List referral codes (admin)
 * @route GET /api/web/referral-codes
 */
export const getAllReferralCodes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive,
      collegeId,
      search,
    } = req.query;

    const query = { isDeleted: false };

    if (typeof isActive !== 'undefined') {
      query.isActive = isActive;
    }

    if (collegeId) {
      query.collegeId = collegeId;
    }

    if (search) {
      query.$or = [
        { code: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [referralCodes, totalCount] = await Promise.all([
      ReferralCode.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('collegeId', 'name city isActive kind'),
      ReferralCode.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return responseUtil.success(res, 'Referral codes retrieved successfully', {
      referralCodes,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('[REFERRAL] List error:', error.message);
    return responseUtil.internalError(res, 'Failed to retrieve referral codes', error.message);
  }
};

/**
 * Get a single referral code (admin)
 * @route GET /api/web/referral-codes/:id
 */
export const getReferralCodeById = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate('collegeId', 'name city isActive kind');

    if (!referralCode) {
      return responseUtil.notFound(res, 'Referral code not found');
    }

    return responseUtil.success(res, 'Referral code retrieved successfully', { referralCode });
  } catch (error) {
    console.error('[REFERRAL] Get error:', error.message);
    return responseUtil.internalError(res, 'Failed to retrieve referral code', error.message);
  }
};

/**
 * Update a referral code (admin)
 * @route PUT /api/web/referral-codes/:id
 */
export const updateReferralCode = async (req, res) => {
  try {
    const existing = await ReferralCode.findOne({ _id: req.params.id, isDeleted: false });

    if (!existing) {
      return responseUtil.notFound(res, 'Referral code not found');
    }

    if (req.body.collegeId) {
      const college = await College.findOne({ _id: req.body.collegeId, isDeleted: false });
      if (!college) {
        return responseUtil.badRequest(res, 'Selected college is not available');
      }
    }

    // Lowering the cap below what has already been used would leave the code in
    // a state it can never recover from, so reject it outright.
    if (
      req.body.maxUses !== undefined &&
      req.body.maxUses !== null &&
      req.body.maxUses < existing.usedCount
    ) {
      return responseUtil.badRequest(
        res,
        `Max uses cannot be lower than the ${existing.usedCount} use(s) already recorded`
      );
    }

    const referralCode = await ReferralCode.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user?._id || req.user?.id },
      { new: true, runValidators: true }
    ).populate('collegeId', 'name city isActive kind');

    console.log('[REFERRAL] Updated:', referralCode.code);

    return responseUtil.success(res, 'Referral code updated successfully', { referralCode });
  } catch (error) {
    console.error('[REFERRAL] Update error:', error.message);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'This referral code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to update referral code', error.message);
  }
};

/**
 * Soft delete a referral code (admin)
 * @route DELETE /api/web/referral-codes/:id
 */
export const deleteReferralCode = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findOne({ _id: req.params.id, isDeleted: false });

    if (!referralCode) {
      return responseUtil.notFound(res, 'Referral code not found');
    }

    await referralCode.softDelete(req.user?._id || req.user?.id);

    console.log('[REFERRAL] Deleted:', referralCode.code);

    return responseUtil.success(res, 'Referral code deleted successfully');
  } catch (error) {
    console.error('[REFERRAL] Delete error:', error.message);
    return responseUtil.internalError(res, 'Failed to delete referral code', error.message);
  }
};

/**
 * Verify a referral code before payment (public).
 *
 * Mirrors the coupon-preview contract the form already uses, but returns a
 * verification result instead of a price: a referral never changes the amount.
 * Read-only — it does not consume a use.
 *
 * @route POST /api/web/referral-codes/validate
 */
export const validateReferralCode = async (req, res) => {
  try {
    const { referralCode, planId } = req.body;

    // If the caller names a plan, confirm it actually needs a referral. Saying
    // "verified" on a plan that ignores referrals would be misleading.
    if (planId) {
      const plan = await MembershipPlan.findOne({ _id: planId, isDeleted: false, isActive: true });

      if (!plan) {
        return responseUtil.badRequest(res, 'Selected plan is not available');
      }

      if (!plan.requiresReferral) {
        return responseUtil.badRequest(res, 'This plan does not require a referral code');
      }
    }

    const result = await ReferralCode.validateCode(referralCode);

    if (!result.isValid) {
      console.log('[REFERRAL-VALIDATE] Rejected:', referralCode, '-', result.error);
      return responseUtil.badRequest(res, result.error);
    }

    const { referral, college } = result;

    console.log('[REFERRAL-VALIDATE] Verified:', referral.code, '->', college.name);

    return responseUtil.success(res, 'Referral code verified', {
      verified: true,
      referralCode: referral.code,
      college: {
        _id: college._id,
        name: college.name,
        city: college.city,
      },
      // Shown as "N uses left" in the form. null means unlimited.
      remainingUses: referral.maxUses === null ? null : referral.maxUses - referral.usedCount,
      expiresAt: referral.expiresAt,
    });
  } catch (error) {
    console.error('[REFERRAL-VALIDATE] Error:', error.message);
    return responseUtil.internalError(res, 'Failed to validate referral code', error.message);
  }
};

/**
 * Active colleges for a public dropdown, if a form ever needs to show them.
 * @route GET /api/web/referral-codes/colleges
 */
export const getPublicColleges = async (req, res) => {
  try {
    const colleges = await College.find({ isDeleted: false, isActive: true })
      .select('name city')
      .sort({ name: 1 });

    return responseUtil.success(res, 'Colleges retrieved successfully', { colleges });
  } catch (error) {
    console.error('[REFERRAL] Public colleges error:', error.message);
    return responseUtil.internalError(res, 'Failed to retrieve colleges', error.message);
  }
};

export default {
  createReferralCode,
  getAllReferralCodes,
  getReferralCodeById,
  updateReferralCode,
  deleteReferralCode,
  validateReferralCode,
  getPublicColleges,
};
