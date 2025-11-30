/**
 * @fileoverview Voucher controller with CRUD and check-availability operations
 * @module controllers/voucher
 */

import Voucher from '../../schema/Voucher.Schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create a new voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with created voucher
 */
export const createVoucher = async (req, res) => {
  try {
    console.log('[VOUCHER] Creating new voucher:', req.body.code);

    const voucherData = {
      ...req.body,
      createdBy: req.user.id
    };

    const voucher = new Voucher(voucherData);
    await voucher.save();

    console.log('[VOUCHER] Voucher created successfully:', voucher._id);

    return responseUtil.created(res, 'Voucher created successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Create voucher error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'Voucher code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to create voucher', error.message);
  }
};

/**
 * Get all vouchers with pagination and filters (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated vouchers
 */
export const getAllVouchers = async (req, res) => {
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
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with pagination
    const [vouchers, totalCount] = await Promise.all([
      Voucher.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('events', 'name'),
      Voucher.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log(`[VOUCHER] Retrieved ${vouchers.length} vouchers (page ${page}/${totalPages})`);

    return responseUtil.success(res, 'Vouchers retrieved successfully', {
      vouchers,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('[VOUCHER] Get all vouchers error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve vouchers', error.message);
  }
};

/**
 * Get voucher by ID (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with voucher details
 */
export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await Voucher.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('events', 'name');

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found:', id);
      return responseUtil.notFound(res, 'Voucher not found');
    }

    console.log('[VOUCHER] Retrieved voucher:', id);

    return responseUtil.success(res, 'Voucher retrieved successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Get voucher by ID error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve voucher', error.message);
  }
};

/**
 * Update voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated voucher
 */
export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    console.log('[VOUCHER] Updating voucher:', id);

    const voucher = await Voucher.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found for update:', id);
      return responseUtil.notFound(res, 'Voucher not found');
    }

    console.log('[VOUCHER] Voucher updated successfully:', id);

    return responseUtil.success(res, 'Voucher updated successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Update voucher error:', error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'Voucher code already exists');
    }

    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to update voucher', error.message);
  }
};

/**
 * Enable voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming voucher enabled
 */
export const enableVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[VOUCHER] Enabling voucher:', id);

    const voucher = await Voucher.findByIdAndUpdate(
      id,
      { isActive: true, updatedBy: req.user.id },
      { new: true }
    );

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found for enable:', id);
      return responseUtil.notFound(res, 'Voucher not found');
    }

    console.log('[VOUCHER] Voucher enabled successfully:', id);

    return responseUtil.success(res, 'Voucher enabled successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Enable voucher error:', error);
    return responseUtil.internalError(res, 'Failed to enable voucher', error.message);
  }
};

/**
 * Disable voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming voucher disabled
 */
export const disableVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[VOUCHER] Disabling voucher:', id);

    const voucher = await Voucher.findByIdAndUpdate(
      id,
      { isActive: false, updatedBy: req.user.id },
      { new: true }
    );

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found for disable:', id);
      return responseUtil.notFound(res, 'Voucher not found');
    }

    console.log('[VOUCHER] Voucher disabled successfully:', id);

    return responseUtil.success(res, 'Voucher disabled successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Disable voucher error:', error);
    return responseUtil.internalError(res, 'Failed to disable voucher', error.message);
  }
};

/**
 * Soft delete voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming deletion
 */
export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[VOUCHER] Soft deleting voucher:', id);

    const voucher = await Voucher.findById(id);

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found for delete:', id);
      return responseUtil.notFound(res, 'Voucher not found');
    }

    await voucher.softDelete(req.user.id);

    console.log('[VOUCHER] Voucher soft deleted successfully:', id);

    return responseUtil.success(res, 'Voucher deleted successfully');
  } catch (error) {
    console.error('[VOUCHER] Delete voucher error:', error);
    return responseUtil.internalError(res, 'Failed to delete voucher', error.message);
  }
};

/**
 * Get deleted vouchers (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with deleted vouchers
 */
export const getDeletedVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.findDeleted()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('deletedBy', 'name email')
      .populate('events', 'name')
      .sort({ deletedAt: -1 });

    console.log(`[VOUCHER] Retrieved ${vouchers.length} deleted vouchers`);

    return responseUtil.success(res, 'Deleted vouchers retrieved successfully', { vouchers });
  } catch (error) {
    console.error('[VOUCHER] Get deleted vouchers error:', error);
    return responseUtil.internalError(res, 'Failed to retrieve deleted vouchers', error.message);
  }
};

/**
 * Restore soft deleted voucher (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming restoration
 */
export const restoreVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[VOUCHER] Restoring voucher:', id);

    const voucher = await Voucher.findOne({ _id: id, isDeleted: true })
      .select('+isDeleted +deletedAt +deletedBy');

    if (!voucher) {
      console.log('[VOUCHER] Deleted voucher not found for restore:', id);
      return responseUtil.notFound(res, 'Deleted voucher not found');
    }

    await voucher.restore();

    console.log('[VOUCHER] Voucher restored successfully:', id);

    return responseUtil.success(res, 'Voucher restored successfully', { voucher });
  } catch (error) {
    console.error('[VOUCHER] Restore voucher error:', error);
    return responseUtil.internalError(res, 'Failed to restore voucher', error.message);
  }
};

/**
 * Permanently delete voucher (Super Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming permanent deletion
 */
export const permanentDeleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[VOUCHER] Permanently deleting voucher:', id);

    const voucher = await Voucher.findOne({ _id: id, isDeleted: true })
      .select('+isDeleted');

    if (!voucher) {
      console.log('[VOUCHER] Deleted voucher not found for permanent delete:', id);
      return responseUtil.notFound(res, 'Deleted voucher not found');
    }

    await Voucher.permanentDelete(id);

    console.log('[VOUCHER] Voucher permanently deleted:', id);

    return responseUtil.success(res, 'Voucher permanently deleted');
  } catch (error) {
    console.error('[VOUCHER] Permanent delete voucher error:', error);
    return responseUtil.internalError(res, 'Failed to permanently delete voucher', error.message);
  }
};

/**
 * Check voucher availability and claim it (User)
 * This endpoint atomically checks and claims a voucher for the given phone number(s)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body.code - Voucher code
 * @param {Object} req.body.phones - Array of phone numbers to claim voucher for
 * @param {Object} req.body.eventId - Optional event ID to check event-specific voucher
 * @param {Object} res - Express response object
 * @returns {Object} Response with voucher availability status
 */
export const checkAvailability = async (req, res) => {
  try {
    const { code, phones, eventId } = req.body;

    console.log('[VOUCHER] Checking availability for code:', code, 'phones:', phones);

    // Normalize phone numbers to last 10 digits
    const normalizedPhones = phones.map(p => p.slice(-10));

    // Validate phone numbers
    for (const phone of normalizedPhones) {
      if (!/^[0-9]{10}$/.test(phone)) {
        console.log('[VOUCHER] Invalid phone number format:', phone);
        return responseUtil.badRequest(res, `Invalid phone number format: ${phone}`);
      }
    }

    // Find the voucher by code
    const voucher = await Voucher.findOne({ code: code.toUpperCase() });

    if (!voucher) {
      console.log('[VOUCHER] Voucher not found:', code);
      return responseUtil.notFound(res, 'Invalid voucher code');
    }

    // Check if voucher is active
    if (!voucher.isActive) {
      console.log('[VOUCHER] Voucher is not active:', code);
      return responseUtil.badRequest(res, 'This voucher is not active');
    }

    // Check if voucher is event-specific and if the event matches
    if (voucher.events && voucher.events.length > 0 && eventId) {
      const eventExists = voucher.events.some(e => e.toString() === eventId);
      if (!eventExists) {
        console.log('[VOUCHER] Voucher not valid for this event:', code, eventId);
        return responseUtil.badRequest(res, 'This voucher is not valid for this event');
      }
    }

    // Check if any phone has already claimed this voucher
    for (const phone of normalizedPhones) {
      if (voucher.claimedPhones.includes(phone)) {
        console.log('[VOUCHER] Phone already claimed voucher:', phone);
        return responseUtil.badRequest(res, `Phone number ${phone} has already claimed this voucher`);
      }
    }

    // Check if there are enough slots available
    // Available slots = maxUsage - claimedPhones.length (includes pending + confirmed)
    const requiredSlots = normalizedPhones.length;
    const availableSlots = voucher.maxUsage - voucher.claimedPhones.length;

    if (availableSlots < requiredSlots) {
      console.log('[VOUCHER] Not enough vouchers available:', availableSlots, 'needed:', requiredSlots);
      return responseUtil.badRequest(
        res,
        'Unlucky, we ran out of vouchers!',
        { availableSlots, requiredSlots }
      );
    }

    // Atomically claim the voucher (reservation only - usageCount is NOT incremented here)
    const updatedVoucher = await Voucher.claimVoucher(voucher._id, normalizedPhones);

    if (!updatedVoucher) {
      // Race condition - voucher ran out between check and claim
      console.log('[VOUCHER] Race condition - voucher ran out during claim:', code);
      return responseUtil.badRequest(res, 'Unlucky, we ran out of vouchers!');
    }

    console.log('[VOUCHER] Voucher reserved successfully:', code, 'for phones:', normalizedPhones);

    return responseUtil.success(res, 'The voucher is available! Claimed successfully.', {
      voucher: {
        id: updatedVoucher._id,
        code: updatedVoucher.code,
        title: updatedVoucher.title,
        description: updatedVoucher.description
      },
      claimedFor: normalizedPhones,
      remainingSlots: updatedVoucher.maxUsage - updatedVoucher.claimedPhones.length
    });
  } catch (error) {
    console.error('[VOUCHER] Check availability error:', error);
    return responseUtil.internalError(res, 'Failed to check voucher availability', error.message);
  }
};

/**
 * Release voucher claim (used by webhook on payment failure)
 * This function releases the voucher claim for the given phone numbers
 *
 * @param {string} voucherId - Voucher ID
 * @param {Array<string>} phones - Array of phone numbers to release
 * @returns {Promise<Object|null>} Updated voucher or null if not found
 */
export const releaseVoucherClaim = async (voucherId, phones) => {
  try {
    console.log('[VOUCHER] Releasing voucher claim:', voucherId, 'for phones:', phones);

    const voucher = await Voucher.releaseVoucher(voucherId, phones);

    if (voucher) {
      console.log('[VOUCHER] Voucher claim released successfully:', voucherId);
    } else {
      console.log('[VOUCHER] Voucher not found for release:', voucherId);
    }

    return voucher;
  } catch (error) {
    console.error('[VOUCHER] Release voucher claim error:', error);
    throw error;
  }
};

/**
 * Redeem voucher for a phone number
 * Removes the phone from claimedPhones WITHOUT changing usageCount
 * This is called when the voucher QR is scanned at the venue
 *
 * @param {Object} req - Express request object
 * @param {string} req.query.phone - Phone number to redeem voucher for
 * @param {Object} res - Express response object
 * @returns {Object} Response with redemption status
 */
export const redeemVoucher = async (req, res) => {
  try {
    const { phone } = req.query;

    console.log('[VOUCHER] Redeeming voucher for phone:', phone);

    if (!phone) {
      console.log('[VOUCHER] No phone number provided for redemption');
      return responseUtil.badRequest(res, 'Phone number is required');
    }

    // Normalize phone number to last 10 digits
    const normalizedPhone = phone.slice(-10);

    // Validate phone number format
    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      console.log('[VOUCHER] Invalid phone number format:', normalizedPhone);
      return responseUtil.badRequest(res, 'Invalid phone number format');
    }

    // Check if voucher exists for this phone
    const existingVoucher = await Voucher.findByClaimedPhone(normalizedPhone);

    if (!existingVoucher) {
      console.log('[VOUCHER] No voucher found for phone:', normalizedPhone);
      return responseUtil.notFound(res, 'No voucher found for this phone number or already redeemed');
    }

    // Redeem the voucher (remove phone from claimedPhones)
    const updatedVoucher = await Voucher.redeemVoucher(normalizedPhone);

    if (!updatedVoucher) {
      console.log('[VOUCHER] Failed to redeem voucher for phone:', normalizedPhone);
      return responseUtil.badRequest(res, 'Voucher already redeemed or not found');
    }

    console.log('[VOUCHER] Voucher redeemed successfully:', {
      voucherId: updatedVoucher._id,
      code: updatedVoucher.code,
      phone: normalizedPhone
    });

    return responseUtil.success(res, 'Voucher redeemed successfully!', {
      voucher: {
        id: updatedVoucher._id,
        code: updatedVoucher.code,
        title: updatedVoucher.title,
        description: updatedVoucher.description
      },
      redeemedPhone: normalizedPhone
    });
  } catch (error) {
    console.error('[VOUCHER] Redeem voucher error:', error);
    return responseUtil.internalError(res, 'Failed to redeem voucher', error.message);
  }
};

export default {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  enableVoucher,
  disableVoucher,
  deleteVoucher,
  getDeletedVouchers,
  restoreVoucher,
  permanentDeleteVoucher,
  checkAvailability,
  releaseVoucherClaim,
  redeemVoucher
};
