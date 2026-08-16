/**
 * @fileoverview College schema
 * A college is the organisation a student referral code belongs to. One college
 * owns many ReferralCodes; the code the student types at checkout is what tags
 * their membership back to this college for reporting.
 * @module schema/College
 */

import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'College name is required'],
      trim: true,
      maxlength: [200, 'College name cannot exceed 200 characters']
    },

    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },

    // 'college' = student organisation, 'leader' = individual ambassador who
    // distributes codes without a college. Same table, same referral logic; the
    // admin UI uses this flag to render Colleges and Leaders as separate pages.
    kind: {
      type: String,
      enum: ['college', 'leader'],
      default: 'college',
      index: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: false
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// The same college name can exist in two cities, so neither field is unique on
// its own — the pair is. Partial filter keeps soft-deleted rows out of the way,
// so a deleted college's name can be reused.
// kind included so a college and a leader can share the same name — they are
// different entities even if labelled the same in the admin panel.
collegeSchema.index(
  { name: 1, city: 1, kind: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
collegeSchema.index({ isDeleted: 1, isActive: 1 });

collegeSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

collegeSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

const College = mongoose.model('College', collegeSchema);

export default College;
