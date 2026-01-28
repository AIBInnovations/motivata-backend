/**
 * @fileoverview Feature Access controller
 * Handles feature access control based on membership
 * @module controllers/featureAccess
 */

import FeatureAccess from '../../schema/FeatureAccess.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import UserFeatureAccess from '../../schema/UserFeatureAccess.schema.js';
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

    // Step 5: Check user's FULL membership status (grants access to ALL features)
    // Query: ACTIVE status + (not expired OR lifetime)
    const membership = await UserMembership.findOne({
      phone: normalizedPhone,
      isDeleted: false,
      status: 'ACTIVE',
      $or: [
        { isLifetime: true }, // Lifetime memberships never expire
        { endDate: { $gte: new Date() } }, // Regular memberships must not be expired
      ],
    }).populate('membershipPlanId');

    // Step 6: If full membership exists, grant access
    if (membership) {
      const daysRemaining = membership.isLifetime
        ? Infinity
        : Math.ceil((membership.endDate - new Date()) / (1000 * 60 * 60 * 24));

      console.log('[FEATURE-ACCESS] Access granted with FULL membership');
      console.log('[FEATURE-ACCESS] Is lifetime:', membership.isLifetime);

      return res.json({
        success: true,
        data: {
          hasAccess: true,
          reason: 'MEMBERSHIP_VALID',
          accessType: 'FULL_MEMBERSHIP',
          message: 'Access granted via full membership',
          membership: {
            planName: membership.membershipPlanId?.name || 'Full Membership',
            endDate: membership.isLifetime ? null : membership.endDate,
            daysRemaining: daysRemaining,
            isLifetime: membership.isLifetime,
          },
        },
      });
    }

    // Step 7: Check for INDIVIDUAL feature access (purchased separately)
    console.log('[FEATURE-ACCESS] No full membership, checking individual feature access');
    const featureAccess = await UserFeatureAccess.findOne({
      phone: normalizedPhone,
      featureKey: featureKey.toUpperCase(),
      isDeleted: false,
      status: 'ACTIVE',
      paymentStatus: 'SUCCESS',
      startDate: { $lte: new Date() },
      $or: [
        { isLifetime: true },
        { endDate: { $gt: new Date() } },
      ],
    });

    if (featureAccess) {
      const daysRemaining = featureAccess.isLifetime
        ? Infinity
        : Math.ceil((featureAccess.endDate - new Date()) / (1000 * 60 * 60 * 24));

      console.log('[FEATURE-ACCESS] Access granted with INDIVIDUAL feature purchase');
      console.log('[FEATURE-ACCESS] Feature:', featureAccess.featureKey);
      console.log('[FEATURE-ACCESS] Is lifetime:', featureAccess.isLifetime);

      return res.json({
        success: true,
        data: {
          hasAccess: true,
          reason: 'FEATURE_ACCESS_VALID',
          accessType: 'INDIVIDUAL_FEATURE',
          message: 'Access granted via individual feature purchase',
          featureAccess: {
            featureKey: featureAccess.featureKey,
            endDate: featureAccess.isLifetime ? null : featureAccess.endDate,
            daysRemaining: daysRemaining,
            isLifetime: featureAccess.isLifetime,
          },
        },
      });
    }

    // Step 8: No access found - neither membership nor individual feature purchase
    console.log('[FEATURE-ACCESS] No active membership or feature access found');
    return res.json({
      success: true,
      data: {
        hasAccess: false,
        reason: 'NO_ACCESS',
        message: 'This feature requires a membership or individual purchase',
        purchaseOptions: {
          fullMembership: true,
          individualFeature: true,
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
