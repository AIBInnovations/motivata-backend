import MotivataBlendBanner from '../../schema/MotivataBlendBanner.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Get the current active Motivata Blend banner
 * @route GET /api/web/motivata-blend/banner
 * @access Public
 */
export const getActiveBanner = async (req, res) => {
  try {
    const banner = await MotivataBlendBanner.findOne({ isActive: true })
      .select('imageUrl altText isActive')
      .lean();

    if (!banner) {
      return responseUtil.notFound(res, 'No active banner found');
    }

    return responseUtil.success(res, 'Banner fetched successfully', banner);
  } catch (error) {
    console.error('[MOTIVATA_BLEND_BANNER] Get active banner error:', error);
    return responseUtil.internalError(res, 'Failed to fetch banner', error.message);
  }
};
