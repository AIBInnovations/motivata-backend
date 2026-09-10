import ChallengeReward from "./challengeReward.schema.js";
import RewardClaim, { generateRedemptionCode } from "./rewardClaim.schema.js";
import Challenge from "./challenge.schema.js";
import UserChallenge from "./userChallenge.schema.js";
import responseUtil from "../../utils/response.util.js";

const CODE_ATTEMPTS = 5;

const describeRequirement = (reward) => {
  if (reward.trigger === "completion") return "Finish the challenge";
  if (reward.trigger === "weekly") {
    return reward.triggerValue === 1
      ? "Complete week 1"
      : `Complete ${reward.triggerValue} weeks`;
  }
  return reward.triggerValue === 1
    ? "Complete a day"
    : `Complete ${reward.triggerValue} days`;
};

const evaluateEligibility = (reward, userChallenge) => {
  if (!userChallenge) {
    return { eligible: false, reason: "Join this challenge first" };
  }

  if (reward.trigger === "completion") {
    return userChallenge.status === "completed"
      ? { eligible: true, reason: null }
      : { eligible: false, reason: describeRequirement(reward) };
  }

  const needed = reward.requiredDays();
  return (userChallenge.daysCompleted || 0) >= needed
    ? { eligible: true, reason: null }
    : { eligible: false, reason: describeRequirement(reward) };
};

const buildQrPayload = (code) => {
  const baseUrl = process.env.SHARE_BASE_URL || "https://motivata.in";
  return `${baseUrl}/open/reward?code=${encodeURIComponent(code)}`;
};

const shapeReward = (reward, userChallenge, claim, claimedCount) => ({
  _id: reward._id,
  challengeId: reward.challengeId,
  title: reward.title,
  description: reward.description || "",
  rewardType: reward.rewardType,
  rewardValue: reward.rewardValue || "",
  trigger: reward.trigger,
  triggerValue: reward.triggerValue,
  requirement: describeRequirement(reward),
  expiresAt: reward.expiresAt,
  expired: reward.isExpired(),
  soldOut: reward.maxClaims > 0 && claimedCount >= reward.maxClaims,
  ...evaluateEligibility(reward, userChallenge),
  claim: claim
    ? {
        _id: claim._id,
        redemptionCode: claim.redemptionCode,
        qrPayload: buildQrPayload(claim.redemptionCode),
        status: claim.status,
        claimedAt: claim.claimedAt,
        redeemedAt: claim.redeemedAt,
      }
    : null,
});

export const getChallengeRewardsForUser = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    const [rewards, userChallenge] = await Promise.all([
      ChallengeReward.find({ challengeId, isActive: true, isDeleted: false }).sort({
        trigger: 1,
        triggerValue: 1,
      }),
      UserChallenge.findOne({ userId, challengeId }),
    ]);

    if (rewards.length === 0) {
      return responseUtil.success(res, "Rewards fetched successfully", { rewards: [] });
    }

    const rewardIds = rewards.map((r) => r._id);

    const [myClaims, counts] = await Promise.all([
      RewardClaim.find({ userId, rewardId: { $in: rewardIds } }).lean(),
      RewardClaim.aggregate([
        { $match: { rewardId: { $in: rewardIds } } },
        { $group: { _id: "$rewardId", count: { $sum: 1 } } },
      ]),
    ]);

    const claimByReward = new Map(myClaims.map((c) => [String(c.rewardId), c]));
    const countByReward = new Map(counts.map((c) => [String(c._id), c.count]));

    return responseUtil.success(res, "Rewards fetched successfully", {
      rewards: rewards.map((reward) =>
        shapeReward(
          reward,
          userChallenge,
          claimByReward.get(String(reward._id)) || null,
          countByReward.get(String(reward._id)) || 0
        )
      ),
    });
  } catch (error) {
    console.error("Get challenge rewards error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch rewards", error.message);
  }
};

export const claimReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const userId = req.user.id;

    const reward = await ChallengeReward.findOne({ _id: rewardId, isActive: true, isDeleted: false });
    if (!reward) {
      return responseUtil.notFound(res, "Reward not found");
    }

    if (reward.isExpired()) {
      return responseUtil.badRequest(res, "This reward has expired");
    }

    const existing = await RewardClaim.findOne({ rewardId, userId });
    if (existing) {
      return responseUtil.success(res, "Reward already claimed", {
        claim: {
          _id: existing._id,
          redemptionCode: existing.redemptionCode,
          qrPayload: buildQrPayload(existing.redemptionCode),
          status: existing.status,
          claimedAt: existing.claimedAt,
          redeemedAt: existing.redeemedAt,
        },
      });
    }

    const userChallenge = await UserChallenge.findOne({ userId, challengeId: reward.challengeId });
    const { eligible, reason } = evaluateEligibility(reward, userChallenge);
    if (!eligible) {
      return responseUtil.badRequest(res, reason || "You have not unlocked this reward yet");
    }

    if (reward.maxClaims > 0) {
      const claimedCount = await RewardClaim.countDocuments({ rewardId });
      if (claimedCount >= reward.maxClaims) {
        return responseUtil.conflict(res, "All rewards have been claimed");
      }
    }

    let claim = null;
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      try {
        claim = await RewardClaim.create({
          rewardId: reward._id,
          challengeId: reward.challengeId,
          userId,
          redemptionCode: generateRedemptionCode(),
        });
        break;
      } catch (err) {
        if (err.code !== 11000) throw err;

        if (err.keyPattern && err.keyPattern.rewardId) {
          const raced = await RewardClaim.findOne({ rewardId, userId });
          if (raced) {
            return responseUtil.success(res, "Reward already claimed", {
              claim: {
                _id: raced._id,
                redemptionCode: raced.redemptionCode,
                qrPayload: buildQrPayload(raced.redemptionCode),
                status: raced.status,
                claimedAt: raced.claimedAt,
                redeemedAt: raced.redeemedAt,
              },
            });
          }
        }
      }
    }

    if (!claim) {
      return responseUtil.internalError(res, "Could not generate a redemption code, please retry");
    }

    return responseUtil.created(res, "Reward claimed successfully", {
      claim: {
        _id: claim._id,
        redemptionCode: claim.redemptionCode,
        qrPayload: buildQrPayload(claim.redemptionCode),
        status: claim.status,
        claimedAt: claim.claimedAt,
        redeemedAt: null,
      },
    });
  } catch (error) {
    console.error("Claim reward error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid reward ID format");
    }

    return responseUtil.internalError(res, "Failed to claim reward", error.message);
  }
};

export const createChallengeReward = async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.body.challengeId, isDeleted: false });
    if (!challenge) {
      return responseUtil.notFound(res, "Challenge not found");
    }

    const reward = await ChallengeReward.create({ ...req.body, createdBy: req.user.id });

    return responseUtil.created(res, "Reward created successfully", { reward });
  } catch (error) {
    console.error("Create challenge reward error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to create reward", error.message);
  }
};

export const getChallengeRewards = async (req, res) => {
  try {
    const { challengeId, isActive } = req.query;

    const query = {};
    if (challengeId) query.challengeId = challengeId;
    if (typeof isActive !== "undefined") query.isActive = isActive === "true" || isActive === true;

    const rewards = await ChallengeReward.find(query)
      .sort({ createdAt: -1 })
      .populate("challengeId", "title category");

    const stats = await RewardClaim.aggregate([
      { $match: { rewardId: { $in: rewards.map((r) => r._id) } } },
      {
        $group: {
          _id: "$rewardId",
          claimed: { $sum: 1 },
          redeemed: { $sum: { $cond: [{ $eq: ["$status", "redeemed"] }, 1, 0] } },
        },
      },
    ]);
    const statsByReward = new Map(stats.map((s) => [String(s._id), s]));

    const withStats = rewards.map((reward) => {
      const stat = statsByReward.get(String(reward._id));
      return {
        ...reward.toObject(),
        claimedCount: stat?.claimed || 0,
        redeemedCount: stat?.redeemed || 0,
      };
    });

    return responseUtil.success(res, "Rewards fetched successfully", { rewards: withStats });
  } catch (error) {
    console.error("Get challenge rewards error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid challenge ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch rewards", error.message);
  }
};

export const updateChallengeReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const updates = { ...req.body, updatedBy: req.user.id };

    delete updates.challengeId;
    delete updates.createdBy;
    delete updates.isDeleted;

    const reward = await ChallengeReward.findByIdAndUpdate(rewardId, updates, {
      new: true,
      runValidators: true,
    });

    if (!reward) {
      return responseUtil.notFound(res, "Reward not found");
    }

    return responseUtil.success(res, "Reward updated successfully", { reward });
  } catch (error) {
    console.error("Update challenge reward error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid reward ID format");
    }

    return responseUtil.internalError(res, "Failed to update reward", error.message);
  }
};

export const deleteChallengeReward = async (req, res) => {
  try {
    const { rewardId } = req.params;

    const reward = await ChallengeReward.findById(rewardId);
    if (!reward) {
      return responseUtil.notFound(res, "Reward not found");
    }

    await reward.softDelete(req.user.id);

    return responseUtil.success(res, "Reward removed successfully");
  } catch (error) {
    console.error("Delete challenge reward error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid reward ID format");
    }

    return responseUtil.internalError(res, "Failed to remove reward", error.message);
  }
};

export const verifyRewardCode = async (req, res) => {
  try {
    const code = String(req.query.code || req.body.code || "").trim().toUpperCase();

    if (!code) {
      return responseUtil.badRequest(res, "Redemption code is required");
    }

    const claim = await RewardClaim.findOne({ redemptionCode: code })
      .populate("rewardId")
      .populate("userId", "name phone")
      .populate("challengeId", "title");

    if (!claim) {
      return responseUtil.notFound(res, "No reward found for this code");
    }

    const reward = claim.rewardId;
    const expired = reward?.expiresAt ? reward.expiresAt.getTime() <= Date.now() : false;

    return responseUtil.success(res, "Reward code found", {
      valid: claim.status === "claimed" && !expired,
      alreadyRedeemed: claim.status === "redeemed",
      expired,
      claim: {
        _id: claim._id,
        redemptionCode: claim.redemptionCode,
        status: claim.status,
        claimedAt: claim.claimedAt,
        redeemedAt: claim.redeemedAt,
      },
      reward: reward
        ? {
            _id: reward._id,
            title: reward.title,
            rewardType: reward.rewardType,
            rewardValue: reward.rewardValue || "",
            expiresAt: reward.expiresAt,
          }
        : null,
      user: claim.userId
        ? { _id: claim.userId._id, name: claim.userId.name, phone: claim.userId.phone }
        : null,
      challenge: claim.challengeId
        ? { _id: claim.challengeId._id, title: claim.challengeId.title }
        : null,
    });
  } catch (error) {
    console.error("Verify reward code error:", error);
    return responseUtil.internalError(res, "Failed to verify reward code", error.message);
  }
};

export const redeemRewardCode = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();

    if (!code) {
      return responseUtil.badRequest(res, "Redemption code is required");
    }

    const claim = await RewardClaim.findOne({ redemptionCode: code }).populate("rewardId");
    if (!claim) {
      return responseUtil.notFound(res, "No reward found for this code");
    }

    const reward = claim.rewardId;
    if (reward?.expiresAt && reward.expiresAt.getTime() <= Date.now()) {
      return responseUtil.badRequest(res, "This reward has expired");
    }

    const updated = await RewardClaim.findOneAndUpdate(
      { _id: claim._id, status: "claimed" },
      { $set: { status: "redeemed", redeemedAt: new Date(), redeemedBy: req.user.id } },
      { new: true }
    );

    if (!updated) {
      return responseUtil.conflict(res, "This reward has already been redeemed");
    }

    return responseUtil.success(res, "Reward redeemed successfully", {
      claim: {
        _id: updated._id,
        redemptionCode: updated.redemptionCode,
        status: updated.status,
        redeemedAt: updated.redeemedAt,
      },
      reward: reward
        ? { _id: reward._id, title: reward.title, rewardType: reward.rewardType }
        : null,
    });
  } catch (error) {
    console.error("Redeem reward code error:", error);
    return responseUtil.internalError(res, "Failed to redeem reward", error.message);
  }
};

export default {
  getChallengeRewardsForUser,
  claimReward,
  createChallengeReward,
  getChallengeRewards,
  updateChallengeReward,
  deleteChallengeReward,
  verifyRewardCode,
  redeemRewardCode,
};
