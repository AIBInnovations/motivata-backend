/**
 * @fileoverview ClubMember schema for tracking club memberships
 * @module schema/ClubMember
 *
 * Tracks which users have joined which clubs.
 * Users must join a club before they can post or view the club feed.
 */

import mongoose from "mongoose";

const clubMemberSchema = new mongoose.Schema(
  {
    /**
     * The user who joined the club
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * The club that was joined
     */
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true,
    },

    /**
     * Membership status
     * PENDING - Join request submitted, waiting for admin approval
     * APPROVED - Approved and active member
     * REJECTED - Join request was rejected
     */
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'APPROVED', // For backwards compatibility with existing records
      index: true,
    },

    /**
     * Admin who reviewed the join request (for approval-required clubs)
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },

    /**
     * When the membership was reviewed/approved
     */
    reviewedAt: {
      type: Date,
      default: null,
    },

    /**
     * Reason for rejection (if status is REJECTED)
     */
    rejectionReason: {
      type: String,
      maxlength: 500,
      default: null,
    },

    /**
     * Soft delete flag - used when user leaves club or club is deleted
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
  }
);

/**
 * Compound unique index to prevent duplicate memberships
 */
clubMemberSchema.index({ user: 1, club: 1 }, { unique: true });

/**
 * Index for getting members of a club
 */
clubMemberSchema.index({ club: 1, isDeleted: 1 });

/**
 * Index for getting clubs a user has joined
 */
clubMemberSchema.index({ user: 1, isDeleted: 1 });

/**
 * Pre-query middleware to exclude soft deleted memberships
 */
clubMemberSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Static method to check if user is member of a club
 */
clubMemberSchema.statics.isMember = async function (userId, clubId) {
  const membership = await this.findOne({
    user: userId,
    club: clubId,
    isDeleted: false,
  });
  return !!membership;
};

/**
 * Static method to check membership for multiple clubs (for feed optimization)
 */
clubMemberSchema.statics.getMembershipStatus = async function (userId, clubIds) {
  const memberships = await this.find({
    user: userId,
    club: { $in: clubIds },
    isDeleted: false,
  }).select("club");

  const joinedClubIds = new Set(memberships.map((m) => m.club.toString()));
  return joinedClubIds;
};

/**
 * Static method to get club members
 */
clubMemberSchema.statics.getClubMembers = function (clubId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ club: clubId })
    .populate({
      path: "user",
      select: "name email phone followerCount followingCount postCount",
      match: { isDeleted: false },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to get clubs a user has joined
 */
clubMemberSchema.statics.getUserClubs = function (userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ user: userId })
    .populate({
      path: "club",
      select: "name description thumbnail memberCount postCount",
      match: { isDeleted: false },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Instance method for soft delete
 */
clubMemberSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Static method to soft delete all memberships for a club (when club is deleted)
 */
clubMemberSchema.statics.softDeleteByClub = async function (clubId) {
  return this.updateMany(
    { club: clubId },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};

/**
 * Static method to soft delete all memberships for a user (when user deletes account)
 */
clubMemberSchema.statics.softDeleteByUser = async function (userId) {
  return this.updateMany(
    { user: userId },
    {
      isDeleted: true,
      deletedAt: new Date(),
    }
  );
};

const ClubMember = mongoose.model("ClubMember", clubMemberSchema);

export default ClubMember;
