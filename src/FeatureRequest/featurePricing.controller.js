/**
 * @fileoverview Feature Pricing controller
 * Admin CRUD operations for feature pricing
 * @module controllers/featurePricing
 */

import FeaturePricing from '../../schema/FeaturePricing.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Create new feature pricing (admin)
 * @route POST /api/admin/feature-pricing
 */
export const createFeaturePricing = async (req, res) => {
  try {
    const {
      featureKey,
      name,
      description,
      price,
      compareAtPrice,
      durationInDays,
      isBundle,
      includedFeatures,
      perks,
      displayOrder,
      isFeatured,
      isActive,
    } = req.body;
    const adminId = req.user?._id;

    console.log('[FEATURE-PRICING] Creating new pricing:', featureKey);

    // Check for duplicate feature key
    const existingPricing = await FeaturePricing.findOne({
      featureKey: featureKey.toUpperCase(),
      isDeleted: false,
    });

    if (existingPricing) {
      return responseUtil.conflict(res, 'A pricing option with this feature key already exists.');
    }

    // Validate bundle has included features
    if (isBundle && (!includedFeatures || includedFeatures.length === 0)) {
      return responseUtil.badRequest(res, 'Bundle must have at least one included feature.');
    }

    const pricing = new FeaturePricing({
      featureKey: featureKey.toUpperCase(),
      name,
      description: description || '',
      price,
      compareAtPrice: compareAtPrice || null,
      durationInDays: durationInDays !== undefined ? durationInDays : null,
      isBundle: isBundle || false,
      includedFeatures: includedFeatures || [],
      perks: perks || [],
      displayOrder: displayOrder || 0,
      isFeatured: isFeatured || false,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: adminId,
    });

    await pricing.save();

    console.log('[FEATURE-PRICING] Pricing created:', pricing._id);

    return responseUtil.created(res, 'Feature pricing created successfully.', { pricing });
  } catch (error) {
    console.error('[FEATURE-PRICING] Error creating pricing:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, 'A pricing option with this feature key already exists.');
    }

    return responseUtil.internalError(res, 'Failed to create feature pricing', error.message);
  }
};

/**
 * Get all feature pricing (admin)
 * @route GET /api/admin/feature-pricing
 */
export const getAllFeaturePricing = async (req, res) => {
  try {
    const { includeInactive = false, includeDeleted = false } = req.query;

    console.log('[FEATURE-PRICING] Fetching all pricing options');

    const query = {};
    if (!includeDeleted || includeDeleted === 'false') {
      query.isDeleted = false;
    }
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    const pricingOptions = await FeaturePricing.find(query)
      .sort({ displayOrder: 1, createdAt: -1 });

    // Separate individual features and bundles
    const individualFeatures = pricingOptions.filter(p => !p.isBundle);
    const bundles = pricingOptions.filter(p => p.isBundle);

    return responseUtil.success(res, 'Feature pricing fetched successfully', {
      pricing: pricingOptions,
      individualFeatures,
      bundles,
      total: pricingOptions.length,
    });
  } catch (error) {
    console.error('[FEATURE-PRICING] Error fetching pricing:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch feature pricing', error.message);
  }
};

/**
 * Get single feature pricing (admin)
 * @route GET /api/admin/feature-pricing/:id
 */
export const getSingleFeaturePricing = async (req, res) => {
  try {
    const { id } = req.params;

    const pricing = await FeaturePricing.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!pricing) {
      return responseUtil.notFound(res, 'Feature pricing not found');
    }

    return responseUtil.success(res, 'Feature pricing fetched successfully', { pricing });
  } catch (error) {
    console.error('[FEATURE-PRICING] Error fetching pricing:', error.message);
    return responseUtil.internalError(res, 'Failed to fetch feature pricing', error.message);
  }
};

/**
 * Update feature pricing (admin)
 * @route PUT /api/admin/feature-pricing/:id
 */
export const updateFeaturePricing = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      compareAtPrice,
      durationInDays,
      isBundle,
      includedFeatures,
      perks,
      displayOrder,
      isFeatured,
      isActive,
    } = req.body;
    const adminId = req.user?._id;

    console.log('[FEATURE-PRICING] Updating pricing:', id);

    const pricing = await FeaturePricing.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!pricing) {
      return responseUtil.notFound(res, 'Feature pricing not found');
    }

    // Update fields if provided
    if (name !== undefined) pricing.name = name;
    if (description !== undefined) pricing.description = description;
    if (price !== undefined) pricing.price = price;
    if (compareAtPrice !== undefined) pricing.compareAtPrice = compareAtPrice;
    if (durationInDays !== undefined) pricing.durationInDays = durationInDays;
    if (isBundle !== undefined) pricing.isBundle = isBundle;
    if (includedFeatures !== undefined) pricing.includedFeatures = includedFeatures;
    if (perks !== undefined) pricing.perks = perks;
    if (displayOrder !== undefined) pricing.displayOrder = displayOrder;
    if (isFeatured !== undefined) pricing.isFeatured = isFeatured;
    if (isActive !== undefined) pricing.isActive = isActive;

    pricing.updatedBy = adminId;

    // Validate bundle has included features
    if (pricing.isBundle && (!pricing.includedFeatures || pricing.includedFeatures.length === 0)) {
      return responseUtil.badRequest(res, 'Bundle must have at least one included feature.');
    }

    await pricing.save();

    console.log('[FEATURE-PRICING] Pricing updated:', pricing._id);

    return responseUtil.success(res, 'Feature pricing updated successfully.', { pricing });
  } catch (error) {
    console.error('[FEATURE-PRICING] Error updating pricing:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(res, 'Failed to update feature pricing', error.message);
  }
};

/**
 * Delete feature pricing (admin - soft delete)
 * @route DELETE /api/admin/feature-pricing/:id
 */
export const deleteFeaturePricing = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id;

    console.log('[FEATURE-PRICING] Deleting pricing:', id);

    const pricing = await FeaturePricing.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!pricing) {
      return responseUtil.notFound(res, 'Feature pricing not found');
    }

    await pricing.softDelete(adminId);

    console.log('[FEATURE-PRICING] Pricing deleted (soft):', id);

    return responseUtil.success(res, 'Feature pricing deleted successfully.');
  } catch (error) {
    console.error('[FEATURE-PRICING] Error deleting pricing:', error.message);
    return responseUtil.internalError(res, 'Failed to delete feature pricing', error.message);
  }
};

/**
 * Restore deleted feature pricing (admin)
 * @route POST /api/admin/feature-pricing/:id/restore
 */
export const restoreFeaturePricing = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('[FEATURE-PRICING] Restoring pricing:', id);

    const pricing = await FeaturePricing.findOne({
      _id: id,
      isDeleted: true,
    });

    if (!pricing) {
      return responseUtil.notFound(res, 'Deleted feature pricing not found');
    }

    await pricing.restore();

    console.log('[FEATURE-PRICING] Pricing restored:', id);

    return responseUtil.success(res, 'Feature pricing restored successfully.', { pricing });
  } catch (error) {
    console.error('[FEATURE-PRICING] Error restoring pricing:', error.message);
    return responseUtil.internalError(res, 'Failed to restore feature pricing', error.message);
  }
};

export default {
  createFeaturePricing,
  getAllFeaturePricing,
  getSingleFeaturePricing,
  updateFeaturePricing,
  deleteFeaturePricing,
  restoreFeaturePricing,
};
