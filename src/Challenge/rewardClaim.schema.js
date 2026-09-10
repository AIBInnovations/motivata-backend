import crypto from "node:crypto";
import mongoose from "mongoose";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRedemptionCode = () => {
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (const byte of bytes) {
    out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `MOT-${out.slice(0, 5)}-${out.slice(5, 10)}`;
};

const rewardClaimSchema = new mongoose.Schema(
  {
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChallengeReward",
      required: true,
    },

    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    redemptionCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["claimed", "redeemed"],
      default: "claimed",
    },

    claimedAt: {
      type: Date,
      default: Date.now,
    },

    redeemedAt: {
      type: Date,
      default: null,
    },

    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

rewardClaimSchema.index({ redemptionCode: 1 }, { unique: true });
rewardClaimSchema.index({ rewardId: 1, userId: 1 }, { unique: true });
rewardClaimSchema.index({ userId: 1, claimedAt: -1 });

const RewardClaim = mongoose.model("RewardClaim", rewardClaimSchema);

export default RewardClaim;
