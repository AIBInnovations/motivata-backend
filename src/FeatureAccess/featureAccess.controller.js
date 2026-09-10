/**
 * @fileoverview Feature Access controller
 * Handles feature access control based on membership
 * @module controllers/featureAccess
 */

import FeatureAccess from '../../schema/FeatureAccess.schema.js';
import responseUtil from '../../utils/response.util.js';
import { resolveFeatureAccess } from './featureAccess.service.js';

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

    const data = await resolveFeatureAccess(featureKey, phone);
    console.log('[FEATURE-ACCESS] Result:', { featureKey, reason: data.reason, hasAccess: data.hasAccess });

    return res.json({ success: true, data });
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
