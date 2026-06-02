/**
 * @fileoverview Membership gating middleware.
 * @module middleware/membership
 */

import User from "../schema/User.schema.js";
import UserMembership from "../schema/UserMembership.schema.js";
import responseUtil from "../utils/response.util.js";
import { DOER_PLAN_NAMES } from "../src/Recommendation/recommendation.constants.js";

/**
 * Resolve the user's phone from the token, falling back to a DB lookup.
 * @param {Object} reqUser - req.user (decoded token)
 * @returns {Promise<string|undefined>}
 */
const resolvePhone = async (reqUser) => {
  if (reqUser.phone) return reqUser.phone;
  const user = await User.findById(reqUser.id).select("phone").lean();
  return user?.phone;
};

/**
 * Whether the authenticated principal is a "Doer".
 * Admins are always Doers. A user is a Doer if they have an active membership
 * whose plan name is in DOER_PLAN_NAMES. If DOER_PLAN_NAMES is empty (not yet
 * configured), any active member is treated as a Doer.
 * @param {Object} reqUser - req.user (decoded token)
 * @returns {Promise<boolean>}
 */
/**
 * Whether the authenticated principal has an active membership.
 * Admins always qualify; users are checked against UserMembership.
 * @param {Object} reqUser - req.user (decoded token)
 * @returns {Promise<boolean>}
 */
export const getIsMember = async (reqUser) => {
  if (!reqUser?.id) return false;
  if (reqUser.userType === "admin") return true;
  const phone = await resolvePhone(reqUser);
  if (!phone) return false;
  return UserMembership.hasActiveMembership(phone);
};

export const getIsDoer = async (reqUser) => {
  if (!reqUser?.id) return false;
  if (reqUser.userType === "admin") return true;

  const phone = await resolvePhone(reqUser);
  if (!phone) return false;

  const membership = await UserMembership.findActiveMembership(phone);
  if (!membership) return false;

  if (!DOER_PLAN_NAMES.length) return true; // not configured → any active member

  const planName = membership.membershipPlanId?.name || membership.planSnapshot?.name;
  return DOER_PLAN_NAMES.includes(planName);
};

/**
 * Allow the request only if the authenticated principal is an admin OR a user
 * with an active membership. Must run after `authenticate`.
 * @param {Object} req - Express request (expects req.user from authenticate)
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
export const requireMemberOrAdmin = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return responseUtil.unauthorized(res, "Authentication required");
    }

    // Admins always pass.
    if (req.user.userType === "admin") {
      return next();
    }

    // Resolve the user's phone (prefer the token, fall back to a lookup).
    let phone = req.user.phone;
    if (!phone) {
      const user = await User.findById(req.user.id).select("phone").lean();
      phone = user?.phone;
    }

    if (phone && (await UserMembership.hasActiveMembership(phone))) {
      return next();
    }

    return responseUtil.forbidden(
      res,
      "Only members can perform this action. Become a member to continue."
    );
  } catch (error) {
    console.error("requireMemberOrAdmin error:", error);
    return responseUtil.internalError(res, "Membership check failed", error.message);
  }
};

/**
 * Allow the request only if the authenticated principal is a Doer (or admin).
 * Must run after `authenticate`.
 */
export const requireDoer = async (req, res, next) => {
  try {
    if (await getIsDoer(req.user)) {
      return next();
    }
    return responseUtil.forbidden(
      res,
      "Only Doers can perform this action."
    );
  } catch (error) {
    console.error("requireDoer error:", error);
    return responseUtil.internalError(res, "Doer check failed", error.message);
  }
};

export default { requireMemberOrAdmin, requireDoer, getIsDoer, getIsMember };
