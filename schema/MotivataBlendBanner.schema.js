import mongoose from 'mongoose';

const motivataBlendBannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      default: 'Motivata Blend',
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'motivata_blend_banners',
  }
);

const MotivataBlendBanner = mongoose.model('MotivataBlendBanner', motivataBlendBannerSchema);

export default MotivataBlendBanner;
