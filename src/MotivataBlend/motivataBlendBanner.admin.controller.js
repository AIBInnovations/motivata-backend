import cloudinary from '../../config/cloudinary.config.js';
import MotivataBlendBanner from '../../schema/MotivataBlendBanner.schema.js';
import responseUtil from '../../utils/response.util.js';

/**
 * Upload or update the Motivata Blend banner
 * @route POST /api/web/motivata-blend/admin/banner
 * @access Admin
 */
export const upsertBanner = async (req, res) => {
  try {
    const file = req.file;
    const { altText, isActive } = req.body;

    if (!file) {
      return responseUtil.badRequest(res, 'Image file is required');
    }

    // Upload to Cloudinary
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const timestamp = Date.now();
    const publicId = `motivata-blend-banner-${timestamp}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: 'motivata-blend-banners',
      public_id: publicId,
      resource_type: 'image',
      overwrite: false,
    });

    // Delete old Cloudinary image if a banner already exists
    const existingBanner = await MotivataBlendBanner.findOne();
    if (existingBanner && existingBanner.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(existingBanner.cloudinaryPublicId);
      } catch (deleteError) {
        console.error('[MOTIVATA_BLEND_BANNER] Failed to delete old image:', deleteError.message);
      }
    }

    // Upsert the banner document
    const updateData = {
      imageUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
    };
    if (altText !== undefined) updateData.altText = altText;

    const banner = await MotivataBlendBanner.findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return responseUtil.success(res, 'Banner updated successfully', {
      imageUrl: banner.imageUrl,
      altText: banner.altText,
      isActive: banner.isActive,
      cloudinaryPublicId: banner.cloudinaryPublicId,
    });
  } catch (error) {
    console.error('[MOTIVATA_BLEND_BANNER] Upsert error:', error);
    return responseUtil.internalError(res, 'Failed to update banner', error.message);
  }
};

/**
 * Delete the Motivata Blend banner
 * @route DELETE /api/web/motivata-blend/admin/banner
 * @access Admin
 */
export const deleteBanner = async (req, res) => {
  try {
    const banner = await MotivataBlendBanner.findOne();

    if (!banner) {
      return responseUtil.notFound(res, 'No banner found to delete');
    }

    // Delete from Cloudinary
    if (banner.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
      } catch (deleteError) {
        console.error('[MOTIVATA_BLEND_BANNER] Failed to delete from Cloudinary:', deleteError.message);
      }
    }

    await MotivataBlendBanner.deleteOne({ _id: banner._id });

    return responseUtil.success(res, 'Banner deleted successfully');
  } catch (error) {
    console.error('[MOTIVATA_BLEND_BANNER] Delete error:', error);
    return responseUtil.internalError(res, 'Failed to delete banner', error.message);
  }
};
