/**
 * @fileoverview Feature Access controller
 * Handles feature access control based on membership
 * @module controllers/featureAccess
 */

import FeatureAccess from '../../schema/FeatureAccess.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Get all feature access settings
 * @route GET /api/web/feature-access
 * @access Admin
 */
export const getAllFeatureAccess = async (req, res) => {
  try {
    console.log('[FEATURE-ACCESS] Fetching all feature access settings');

    const features = await FeatureAccess.find({}).sort({ featureKey: 1 });

    console.log('[FEATURE-ACCESS] Found', features.length, 'features');

    return responseUtil.success(res, 'Feature access settings fetched successfully', {
      features,
    });
  } catch (error) {
    console.error('[FEATURE-ACCESS] Error fetching features:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to fetch feature access settings',
      error.message
    );
  }
};

/**
 * Update feature access settings
 * @route PUT /api/web/feature-access
 * @access Admin
 */
export const updateFeatureAccess = async (req, res) => {
  try {
    const { featureKey, requiresMembership, isActive } = req.body;

    console.log('[FEATURE-ACCESS] Updating feature:', featureKey);
    console.log('[FEATURE-ACCESS] Settings:', { requiresMembership, isActive });

    // Validate required fields
    if (!featureKey) {
      return responseUtil.badRequest(res, 'Feature key is required');
    }

    // Build update object
    const updateData = {};
    if (requiresMembership !== undefined) {
      updateData.requiresMembership = requiresMembership;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update or create feature
    const feature = await FeatureAccess.findOneAndUpdate(
      { featureKey: featureKey.toUpperCase() },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    console.log('[FEATURE-ACCESS] Feature updated:', feature._id);

    return responseUtil.success(res, 'Feature access updated successfully', {
      feature,
    });
  } catch (error) {
    console.error('[FEATURE-ACCESS] Error updating feature:', error.message);
    return responseUtil.internalError(
      res,
      'Failed to update feature access',
      error.message
    );
  }
};

/**
 * Check if user has access to a feature
 * @route POST /api/web/feature-access/check
 * @access Public
 */
export const checkFeatureAccess = async (req, res) => {
  try {
    const { featureKey, phone } = req.body;

    console.log('[FEATURE-ACCESS] Checking access for:', { featureKey, phone });

    // Step 1: Validate input
    if (!featureKey || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: phone and featureKey are required',
        status: 400,
      });
    }

    // Normalize phone to last 10 digits
    const normalizedPhone = phone.slice(-10);

    // Step 2: Get feature settings
    const feature = await FeatureAccess.findOne({
      featureKey: featureKey.toUpperCase(),
    });

    // Step 3: Check if feature exists and is active
    if (!feature || !feature.isActive) {
      console.log('[FEATURE-ACCESS] Feature inactive or not found');
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'FEATURE_INACTIVE',
          message: 'This feature is currently unavailable',
        },
      });
    }

    // Step 4: Check if membership is required
    if (!feature.requiresMembership) {
      console.log('[FEATURE-ACCESS] Feature is open to all');
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          reason: 'OPEN_TO_ALL',
          message: 'Access granted',
        },
      });
    }

    // Step 5: Check user's membership status
    const membership = await UserMembership.findOne({
      phone: normalizedPhone,
      isDeleted: false,
      status: 'ACTIVE',
      endDate: { $gte: new Date() },
    }).populate('membershipPlanId');

    // Step 6: Validate membership
    if (!membership) {
      console.log('[FEATURE-ACCESS] No active membership found');
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'NO_ACTIVE_MEMBERSHIP',
          message: 'This feature requires an active membership',
        },
      });
    }

    // All checks passed - grant access
    const daysRemaining = Math.ceil(
      (membership.endDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    console.log('[FEATURE-ACCESS] Access granted with membership');

    return res.json({
      success: true,
      data: {
        hasAccess: true,
        reason: 'MEMBERSHIP_VALID',
        message: 'Access granted',
        membership: {
          planName: membership.membershipPlanId?.name || 'Unknown Plan',
          endDate: membership.endDate,
          daysRemaining: daysRemaining,
        },
      },
    });
  } catch (error) {
    console.error('[FEATURE-ACCESS] Error checking access:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      status: 500,
    });
  }
};

export default {
  getAllFeatureAccess,
  updateFeatureAccess,
  checkFeatureAccess,
};
