import mongoose from "mongoose";
import { ICON_KEYS } from "./challenge.icons.js";

const dailyChallengeSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      default: null,
    },

    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    icon: {
      type: String,
      enum: {
        values: [...ICON_KEYS, null],
        message: "{VALUE} is not a valid icon",
      },
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    deletedAt: {
      type: Date,
      select: false,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

dailyChallengeSchema.pre("validate", function (next) {
  if (!this.challengeId && !this.title) {
    return next(new Error("Either challengeId or title is required"));
  }
  next();
});

dailyChallengeSchema.index({ dateKey: 1 }, { unique: true });
dailyChallengeSchema.index({ isActive: 1, isDeleted: 1 });

dailyChallengeSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

dailyChallengeSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

dailyChallengeSchema.statics.findByDateKey = function (dateKey) {
  return this.findOne({ dateKey, isActive: true, isDeleted: false });
};

dailyChallengeSchema.statics.findInRange = function (fromKey, toKey) {
  return this.find({ dateKey: { $gte: fromKey, $lte: toKey }, isDeleted: false }).sort({
    dateKey: 1,
  });
};

const DailyChallenge = mongoose.model("DailyChallenge", dailyChallengeSchema);

export default DailyChallenge;
