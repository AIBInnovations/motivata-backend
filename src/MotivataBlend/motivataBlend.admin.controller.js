/**
 * @fileoverview Motivata Blend admin controller
 * Handles admin operations for Motivata Blend registration requests
 * @module controllers/motivataBlend/admin
 */

import MotivataBlendRequest from '../../schema/MotivataBlendRequest.schema.js';
import responseUtil from '../../utils/response.util.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * Get all Motivata Blend requests with filters
 * @route GET /api/web/motivata-blend/admin/requests
 * @access Admin only
 */
export const getAllMotivataBlendRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('[MOTIVATA-BLEND-ADMIN] Fetching requests - page:', page, 'status:', status);

    const query = { isDeleted: false };

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
      MotivataBlendRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reviewedBy', 'name email'),
      MotivataBlendRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    console.log('[MOTIVATA-BLEND-ADMIN] Found', requests.length, 'requests out of', totalCount);

    return responseUtil.success(res, 'Motivata Blend requests fetched successfully', {
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
    console.error('[MOTIVATA-BLEND-ADMIN] Error fetching requests:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Motivata Blend requests',
      error.message
    );
  }
};

/**
 * Get single Motivata Blend request by ID
 * @route GET /api/web/motivata-blend/admin/requests/:id
 * @access Admin only
 */
export const getMotivataBlendRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[MOTIVATA-BLEND-ADMIN] Fetching request:', id);

    const request = await MotivataBlendRequest.findOne({
      _id: id,
      isDeleted: false
    }).populate('reviewedBy', 'name email');

    if (!request) {
      return responseUtil.notFound(res, 'Motivata Blend request not found');
    }

    return responseUtil.success(res, 'Motivata Blend request fetched successfully', {
      request
    });
  } catch (error) {
    console.error('[MOTIVATA-BLEND-ADMIN] Error fetching request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Motivata Blend request',
      error.message
    );
  }
};

/**
 * Approve Motivata Blend request
 * @route POST /api/web/motivata-blend/admin/requests/:id/approve
 * @access Admin only
 */
export const approveMotivataBlendRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?._id;

    console.log('[MOTIVATA-BLEND-ADMIN] Approving request:', id);
    console.log('[MOTIVATA-BLEND-ADMIN] Admin:', adminId);

    const request = await MotivataBlendRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Motivata Blend request not found');
    }

    if (request.status !== 'PENDING') {
      return responseUtil.badRequest(
        res,
        `Cannot approve request with status: ${request.status}. Only PENDING requests can be approved.`
      );
    }

    // Update request
    request.status = 'APPROVED';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    if (notes) {
      request.notes = notes;
    }

    await request.save();

    // Populate reviewedBy for response
    await request.populate('reviewedBy', 'name email');

    console.log('[MOTIVATA-BLEND-ADMIN] Request approved successfully');

    return responseUtil.success(res, 'Motivata Blend request approved successfully', {
      request
    });
  } catch (error) {
    console.error('[MOTIVATA-BLEND-ADMIN] Error approving request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to approve Motivata Blend request',
      error.message
    );
  }
};

/**
 * Reject Motivata Blend request
 * @route POST /api/web/motivata-blend/admin/requests/:id/reject
 * @access Admin only
 */
export const rejectMotivataBlendRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?._id;

    console.log('[MOTIVATA-BLEND-ADMIN] Rejecting request:', id);
    console.log('[MOTIVATA-BLEND-ADMIN] Admin:', adminId);
    console.log('[MOTIVATA-BLEND-ADMIN] Rejection notes:', notes);

    if (!notes || notes.trim().length === 0) {
      return responseUtil.badRequest(res, 'Rejection notes are required');
    }

    const request = await MotivataBlendRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Motivata Blend request not found');
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

    // Populate reviewedBy for response
    await request.populate('reviewedBy', 'name email');

    console.log('[MOTIVATA-BLEND-ADMIN] Request rejected successfully');

    return responseUtil.success(res, 'Motivata Blend request rejected successfully', {
      request
    });
  } catch (error) {
    console.error('[MOTIVATA-BLEND-ADMIN] Error rejecting request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to reject Motivata Blend request',
      error.message
    );
  }
};

/**
 * Get Motivata Blend statistics
 * @route GET /api/web/motivata-blend/admin/stats
 * @access Admin only
 */
export const getMotivataBlendStats = async (req, res) => {
  try {
    console.log('[MOTIVATA-BLEND-ADMIN] Fetching statistics');

    const [totalRequests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      MotivataBlendRequest.countDocuments({ isDeleted: false }),
      MotivataBlendRequest.countDocuments({ isDeleted: false, status: 'PENDING' }),
      MotivataBlendRequest.countDocuments({ isDeleted: false, status: 'APPROVED' }),
      MotivataBlendRequest.countDocuments({ isDeleted: false, status: 'REJECTED' })
    ]);

    // Get requests per day for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requestsPerDay = await MotivataBlendRequest.aggregate([
      {
        $match: {
          isDeleted: false,
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
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1
        }
      }
    ]);

    const stats = {
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      requestsPerDay
    };

    console.log('[MOTIVATA-BLEND-ADMIN] Statistics:', stats);

    return responseUtil.success(res, 'Motivata Blend statistics fetched successfully', stats);
  } catch (error) {
    console.error('[MOTIVATA-BLEND-ADMIN] Error fetching statistics:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Motivata Blend statistics',
      error.message
    );
  }
};

/**
 * Get pending requests count
 * @route GET /api/web/motivata-blend/admin/pending-count
 * @access Admin only
 */
export const getPendingCount = async (req, res) => {
  try {
    const pendingCount = await MotivataBlendRequest.countDocuments({
      isDeleted: false,
      status: 'PENDING'
    });

    return responseUtil.success(res, 'Pending count fetched successfully', {
      pendingCount
    });
  } catch (error) {
    console.error('[MOTIVATA-BLEND-ADMIN] Error fetching pending count:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch pending count',
      error.message
    );
  }
};

export default {
  getAllMotivataBlendRequests,
  getMotivataBlendRequestById,
  approveMotivataBlendRequest,
  rejectMotivataBlendRequest,
  getMotivataBlendStats,
  getPendingCount
};
