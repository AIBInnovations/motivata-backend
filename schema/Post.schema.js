/**
 * @fileoverview Post schema for Connect social feed feature
 * @module schema/Post
 *
 * Post types:
 * - IMAGE: One or more images (mediaUrls array)
 * - VIDEO: Exactly one video (mediaUrls array with single item)
 *
 * All posts must have media. Caption is optional.
 */

import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    /**
     * Post author (User who created the post)
     */
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * Post caption (optional text accompanying media)
     */
    caption: {
      type: String,
      trim: true,
      maxlength: [2000, "Caption cannot exceed 2000 characters"],
      default: "",
    },

    /**
     * Media type - IMAGE (one or more) or VIDEO (exactly one)
     */
    mediaType: {
      type: String,
      enum: {
        values: ["IMAGE", "VIDEO"],
        message: "{VALUE} is not a valid media type. Must be IMAGE or VIDEO",
      },
      required: [true, "Media type is required"],
    },

    /**
     * Media URLs array
     * - For IMAGE: 1 or more URLs
     * - For VIDEO: exactly 1 URL
     */
    mediaUrls: {
      type: [String],
      required: [true, "At least one media URL is required"],
      validate: {
        validator: function (urls) {
          if (!urls || urls.length === 0) return false;
          // All URLs must be valid
          const urlPattern = /^https?:\/\/.+/;
          return urls.every((url) => urlPattern.test(url));
        },
        message: "Please provide valid media URLs",
      },
    },

    /**
     * Media thumbnail URL (for videos)
     */
    mediaThumbnail: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid thumbnail URL"],
      default: null,
    },

    /**
     * Like count (denormalized for performance)
     */
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Share count
     */
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Optional club association
     * If set, post belongs to a club and will NOT appear in main feed
     */
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      default: null,
      index: true,
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for performance
 */
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ club: 1, createdAt: -1 });
postSchema.index({ club: 1, isDeleted: 1 });

/**
 * Pre-query middleware to exclude soft deleted posts
 */
postSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save validation
 * - Media is required
 * - VIDEO must have exactly 1 URL
 * - IMAGE must have at least 1 URL
 */
postSchema.pre("save", function (next) {
  // Validate media is provided
  if (!this.mediaUrls || this.mediaUrls.length === 0) {
    return next(new Error("Post must have at least one media URL"));
  }

  // Validate VIDEO has exactly 1 URL
  if (this.mediaType === "VIDEO" && this.mediaUrls.length !== 1) {
    return next(new Error("Video posts must have exactly one video URL"));
  }

  // IMAGE can have 1 or more URLs (no upper limit for now, but could add one)
  if (this.mediaType === "IMAGE" && this.mediaUrls.length > 10) {
    return next(new Error("Image posts cannot have more than 10 images"));
  }

  next();
});

/**
 * Static method to find deleted posts
 */
postSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select(
    "+isDeleted +deletedAt"
  );
};

/**
 * Instance method for soft delete
 */
postSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Instance method to restore soft deleted post
 */
postSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

/**
 * Static method for permanent delete
 */
postSchema.statics.permanentDelete = function (id) {
  return this.findByIdAndDelete(id);
};

/**
 * Instance method to increment like count
 */
postSchema.methods.incrementLikeCount = function () {
  this.likeCount = (this.likeCount || 0) + 1;
  return this.save();
};

/**
 * Instance method to decrement like count
 */
postSchema.methods.decrementLikeCount = function () {
  if (this.likeCount > 0) {
    this.likeCount -= 1;
  }
  return this.save();
};

/**
 * Instance method to increment share count
 */
postSchema.methods.incrementShareCount = function () {
  this.shareCount = (this.shareCount || 0) + 1;
  return this.save();
};

const Post = mongoose.model("Post", postSchema);

export default Post;
