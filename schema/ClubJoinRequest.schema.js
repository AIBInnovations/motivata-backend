/**
 * @fileoverview ClubJoinRequest schema for tracking club join requests
 * @module schema/ClubJoinRequest
 *
 * Tracks join requests for clubs that require admin approval.
 * After approval, a ClubMember record is created.
 */

import mongoose from 'mongoose';

const clubJoinRequestSchema = new mongoose.Schema(
  {
    /**
     * The user requesting to join
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /**
     * The club user wants to join
     */
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
      index: true,
    },

    /**
     * Request status
     */
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },

    /**
     * User's note explaining why they want to join
     */
    userNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    /**
     * Admin who reviewed this request
     */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },

    /**
     * When the request was reviewed
     */
    reviewedAt: {
      type: Date,
      default: null,
    },

    /**
     * Reason for rejection (if rejected)
     */
    rejectionReason: {
      type: String,
      maxlength: 500,
      default: null,
    },

    /**
     * Admin's internal notes
     */
    adminNotes: {
      type: String,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for performance
 */
clubJoinRequestSchema.index({ user: 1, club: 1 });
clubJoinRequestSchema.index({ status: 1, createdAt: -1 });
clubJoinRequestSchema.index({ club: 1, status: 1 });

/**
 * Static: Get pending requests count
 */
clubJoinRequestSchema.statics.getPendingCount = function () {
  return this.countDocuments({ status: 'PENDING' });
};

/**
 * Static: Check if user has pending request for club
 */
clubJoinRequestSchema.statics.hasPendingRequest = async function (userId, clubId) {
  const request = await this.findOne({
    user: userId,
    club: clubId,
    status: 'PENDING',
  });
  return !!request;
};

/**
 * Instance method: Approve request
 */
clubJoinRequestSchema.methods.approve = async function (adminId, adminNotes = null) {
  this.status = 'APPROVED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.adminNotes = adminNotes;
  return this.save();
};

/**
 * Instance method: Reject request
 */
clubJoinRequestSchema.methods.reject = async function (adminId, rejectionReason, adminNotes = null) {
  this.status = 'REJECTED';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = rejectionReason;
  this.adminNotes = adminNotes;
  return this.save();
};

const ClubJoinRequest = mongoose.model('ClubJoinRequest', clubJoinRequestSchema);

export default ClubJoinRequest;
