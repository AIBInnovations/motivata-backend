import mongoose from "mongoose";

export const REWARD_TYPES = ["discount", "free_product", "free_ticket"];
export const REWARD_TRIGGERS = ["daily", "weekly", "completion"];

const challengeRewardSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: [true, "Challenge is required"],
    },

    title: {
      type: String,
      required: [true, "Reward title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    rewardType: {
      type: String,
      enum: {
        values: REWARD_TYPES,
        message: "{VALUE} is not a valid reward type",
      },
      required: [true, "Reward type is required"],
    },

    rewardValue: {
      type: String,
      trim: true,
      maxlength: [200, "Reward value cannot exceed 200 characters"],
    },

    trigger: {
      type: String,
      enum: {
        values: REWARD_TRIGGERS,
        message: "{VALUE} is not a valid trigger",
      },
      required: [true, "Trigger is required"],
    },

    triggerValue: {
      type: Number,
      min: [1, "Trigger value must be at least 1"],
      max: [365, "Trigger value cannot exceed 365"],
      default: 1,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    maxClaims: {
      type: Number,
      min: [0, "Max claims cannot be negative"],
      default: 0,
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

challengeRewardSchema.index({ challengeId: 1, isActive: 1, isDeleted: 1 });
challengeRewardSchema.index({ trigger: 1 });

challengeRewardSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

challengeRewardSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

challengeRewardSchema.methods.isExpired = function () {
  return !!this.expiresAt && this.expiresAt.getTime() <= Date.now();
};

challengeRewardSchema.methods.requiredDays = function () {
  if (this.trigger === "weekly") return this.triggerValue * 7;
  if (this.trigger === "daily") return this.triggerValue;
  return null;
};

const ChallengeReward = mongoose.model("ChallengeReward", challengeRewardSchema);

export default ChallengeReward;
