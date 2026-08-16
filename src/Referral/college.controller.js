/**
 * @fileoverview College controller — admin CRUD for student organisations.
 *
 * A college owns referral codes. Deleting or deactivating a college disables
 * every code under it (see ReferralCode.validateCode), so codes never need to
 * be edited one by one.
 *
 * @module controllers/college
 */

import College from '../../schema/College.schema.js';
import ReferralCode from '../../schema/ReferralCode.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create a college (admin)
 * @route POST /api/web/colleges
 */
export const createCollege = async (req, res) => {
  try {
    const college = new College({
      ...req.body,
      createdBy: req.user?._id || req.user?.id,
    });

    await college.save();

    console.log('[COLLEGE] Created:', college.name, '-', college.city);

    return responseUtil.created(res, 'College created successfully', { college });
  } catch (error) {
    console.error('[COLLEGE] Create error:', error.message);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'A college with this name already exists in this city');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create college', error.message);
  }
};

/**
 * List colleges (admin)
 * @route GET /api/web/colleges
 */
export const getAllColleges = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', isActive, kind, search } = req.query;

    const query = { isDeleted: false };

    if (typeof isActive !== 'undefined') {
      query.isActive = isActive;
    }

    if (kind) {
      query.kind = kind;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { city: new RegExp(search, 'i') },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [colleges, totalCount] = await Promise.all([
      College.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
      College.countDocuments(query),
    ]);

    // Each row shows how many codes the college has, so the admin can see at a
    // glance which colleges are actually set up.
    const collegeIds = colleges.map((c) => c._id);
    const codeCounts = await ReferralCode.aggregate([
      { $match: { collegeId: { $in: collegeIds }, isDeleted: false } },
      { $group: { _id: '$collegeId', codeCount: { $sum: 1 }, totalUsed: { $sum: '$usedCount' } } },
    ]);

    const countsById = new Map(codeCounts.map((c) => [String(c._id), c]));

    const enriched = colleges.map((college) => {
      const stats = countsById.get(String(college._id));
      return {
        ...college,
        codeCount: stats?.codeCount || 0,
        totalUsed: stats?.totalUsed || 0,
      };
    });

    const totalPages = Math.ceil(totalCount / Number(limit));

    return responseUtil.success(res, 'Colleges retrieved successfully', {
      colleges: enriched,
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
    console.error('[COLLEGE] List error:', error.message);
    return responseUtil.internalError(res, 'Failed to retrieve colleges', error.message);
  }
};

/**
 * Get a single college (admin)
 * @route GET /api/web/colleges/:id
 */
export const getCollegeById = async (req, res) => {
  try {
    const college = await College.findOne({ _id: req.params.id, isDeleted: false });

    if (!college) {
      return responseUtil.notFound(res, 'College not found');
    }

    return responseUtil.success(res, 'College retrieved successfully', { college });
  } catch (error) {
    console.error('[COLLEGE] Get error:', error.message);
    return responseUtil.internalError(res, 'Failed to retrieve college', error.message);
  }
};

/**
 * Update a college (admin)
 * @route PUT /api/web/colleges/:id
 */
export const updateCollege = async (req, res) => {
  try {
    const college = await College.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { ...req.body, updatedBy: req.user?._id || req.user?.id },
      { new: true, runValidators: true }
    );

    if (!college) {
      return responseUtil.notFound(res, 'College not found');
    }

    console.log('[COLLEGE] Updated:', college._id);

    return responseUtil.success(res, 'College updated successfully', { college });
  } catch (error) {
    console.error('[COLLEGE] Update error:', error.message);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'A college with this name already exists in this city');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to update college', error.message);
  }
};

/**
 * Soft delete a college (admin)
 * @route DELETE /api/web/colleges/:id
 */
export const deleteCollege = async (req, res) => {
  try {
    const college = await College.findOne({ _id: req.params.id, isDeleted: false });

    if (!college) {
      return responseUtil.notFound(res, 'College not found');
    }

    await college.softDelete(req.user?._id || req.user?.id);

    console.log('[COLLEGE] Deleted:', college._id);

    return responseUtil.success(res, 'College deleted successfully');
  } catch (error) {
    console.error('[COLLEGE] Delete error:', error.message);
    return responseUtil.internalError(res, 'Failed to delete college', error.message);
  }
};

/**
 * College-wise student report (admin).
 *
 * Counts memberships that actually got paid for, grouped by college. Only
 * referral-tagged memberships have a collegeId, so this is exactly the set of
 * student sign-ups.
 *
 * @route GET /api/web/colleges/report
 */
export const getCollegeReport = async (req, res) => {
  try {
    const { kind } = req.query;

    const rows = await UserMembership.aggregate([
      {
        $match: {
          collegeId: { $ne: null },
          paymentStatus: 'SUCCESS',
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$collegeId',
          studentCount: { $sum: 1 },
          totalRevenue: { $sum: '$amountPaid' },
          lastJoinedAt: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'colleges',
          localField: '_id',
          foreignField: '_id',
          as: 'college',
        },
      },
      { $unwind: '$college' },
      // Filter after the lookup so kind lives on the college doc, not the
      // membership. Omit kind → both colleges and leaders combined.
      ...(kind ? [{ $match: { 'college.kind': kind } }] : []),
      {
        $project: {
          _id: 0,
          collegeId: '$_id',
          collegeName: '$college.name',
          city: '$college.city',
          kind: '$college.kind',
          isActive: '$college.isActive',
          studentCount: 1,
          totalRevenue: 1,
          lastJoinedAt: 1,
        },
      },
      { $sort: { studentCount: -1 } },
    ]);

    const totals = rows.reduce(
      (acc, row) => ({
        students: acc.students + row.studentCount,
        revenue: acc.revenue + (row.totalRevenue || 0),
      }),
      { students: 0, revenue: 0 }
    );

    return responseUtil.success(res, 'College report generated successfully', {
      report: rows,
      totals: {
        colleges: rows.length,
        students: totals.students,
        revenue: totals.revenue,
      },
    });
  } catch (error) {
    console.error('[COLLEGE] Report error:', error.message);
    return responseUtil.internalError(res, 'Failed to generate college report', error.message);
  }
};

export default {
  createCollege,
  getAllColleges,
  getCollegeById,
  updateCollege,
  deleteCollege,
  getCollegeReport,
};
