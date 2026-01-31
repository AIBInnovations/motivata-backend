/**
 * @fileoverview Round Table admin controller
 * Handles admin operations for Round Table registration requests
 * @module controllers/roundTable/admin
 */

import RoundTableRequest from '../../schema/RoundTableRequest.schema.js';
import responseUtil from '../../utils/response.util.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * Get all Round Table requests with filters
 * @route GET /api/web/round-table/admin/requests
 * @access Admin only
 */
export const getAllRoundTableRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('[ROUND-TABLE-ADMIN] Fetching requests - page:', page, 'status:', status);

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
      RoundTableRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reviewedBy', 'name email'),
      RoundTableRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    console.log('[ROUND-TABLE-ADMIN] Found', requests.length, 'requests out of', totalCount);

    return responseUtil.success(res, 'Round Table requests fetched successfully', {
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
    console.error('[ROUND-TABLE-ADMIN] Error fetching requests:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Round Table requests',
      error.message
    );
  }
};

/**
 * Get single Round Table request by ID
 * @route GET /api/web/round-table/admin/requests/:id
 * @access Admin only
 */
export const getRoundTableRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[ROUND-TABLE-ADMIN] Fetching request:', id);

    const request = await RoundTableRequest.findOne({
      _id: id,
      isDeleted: false
    }).populate('reviewedBy', 'name email');

    if (!request) {
      return responseUtil.notFound(res, 'Round Table request not found');
    }

    return responseUtil.success(res, 'Round Table request fetched successfully', {
      request
    });
  } catch (error) {
    console.error('[ROUND-TABLE-ADMIN] Error fetching request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Round Table request',
      error.message
    );
  }
};

/**
 * Approve Round Table request
 * @route POST /api/web/round-table/admin/requests/:id/approve
 * @access Admin only
 */
export const approveRoundTableRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?._id;

    console.log('[ROUND-TABLE-ADMIN] Approving request:', id);
    console.log('[ROUND-TABLE-ADMIN] Admin:', adminId);

    const request = await RoundTableRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Round Table request not found');
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

    console.log('[ROUND-TABLE-ADMIN] Request approved successfully');

    return responseUtil.success(res, 'Round Table request approved successfully', {
      request
    });
  } catch (error) {
    console.error('[ROUND-TABLE-ADMIN] Error approving request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to approve Round Table request',
      error.message
    );
  }
};

/**
 * Reject Round Table request
 * @route POST /api/web/round-table/admin/requests/:id/reject
 * @access Admin only
 */
export const rejectRoundTableRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user?._id;

    console.log('[ROUND-TABLE-ADMIN] Rejecting request:', id);
    console.log('[ROUND-TABLE-ADMIN] Admin:', adminId);
    console.log('[ROUND-TABLE-ADMIN] Rejection notes:', notes);

    if (!notes || notes.trim().length === 0) {
      return responseUtil.badRequest(res, 'Rejection notes are required');
    }

    const request = await RoundTableRequest.findOne({
      _id: id,
      isDeleted: false
    });

    if (!request) {
      return responseUtil.notFound(res, 'Round Table request not found');
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

    console.log('[ROUND-TABLE-ADMIN] Request rejected successfully');

    return responseUtil.success(res, 'Round Table request rejected successfully', {
      request
    });
  } catch (error) {
    console.error('[ROUND-TABLE-ADMIN] Error rejecting request:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to reject Round Table request',
      error.message
    );
  }
};

/**
 * Get Round Table statistics
 * @route GET /api/web/round-table/admin/stats
 * @access Admin only
 */
export const getRoundTableStats = async (req, res) => {
  try {
    console.log('[ROUND-TABLE-ADMIN] Fetching statistics');

    const [totalRequests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      RoundTableRequest.countDocuments({ isDeleted: false }),
      RoundTableRequest.countDocuments({ isDeleted: false, status: 'PENDING' }),
      RoundTableRequest.countDocuments({ isDeleted: false, status: 'APPROVED' }),
      RoundTableRequest.countDocuments({ isDeleted: false, status: 'REJECTED' })
    ]);

    // Get requests per day for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requestsPerDay = await RoundTableRequest.aggregate([
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

    console.log('[ROUND-TABLE-ADMIN] Statistics:', stats);

    return responseUtil.success(res, 'Round Table statistics fetched successfully', stats);
  } catch (error) {
    console.error('[ROUND-TABLE-ADMIN] Error fetching statistics:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch Round Table statistics',
      error.message
    );
  }
};

/**
 * Get pending requests count
 * @route GET /api/web/round-table/admin/pending-count
 * @access Admin only
 */
export const getPendingCount = async (req, res) => {
  try {
    const pendingCount = await RoundTableRequest.countDocuments({
      isDeleted: false,
      status: 'PENDING'
    });

    return responseUtil.success(res, 'Pending count fetched successfully', {
      pendingCount
    });
  } catch (error) {
    console.error('[ROUND-TABLE-ADMIN] Error fetching pending count:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch pending count',
      error.message
    );
  }
};

export default {
  getAllRoundTableRequests,
  getRoundTableRequestById,
  approveRoundTableRequest,
  rejectRoundTableRequest,
  getRoundTableStats,
  getPendingCount
};
