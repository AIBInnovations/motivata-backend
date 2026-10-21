import User from "../../schema/User.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import EventRequest from "../../schema/EventRequest.schema.js";
import { tierMeetsAudience, getAccessTier } from "../../middleware/membership.middleware.js";
import { maskCreators } from "../shared/creatorMask.util.js";

export const INVITE_ONLY_ERROR_CODE = "EVENT_INVITE_ONLY";
export const INVITE_ONLY_MESSAGE =
  "This event is invite only. Request an invite from motivata.in or WhatsApp us.";
export const INVITE_APPROVED_STATUSES = ["APPROVED", "PAYMENT_SENT", "COMPLETED"];

export const computeEventAccess = (audience, viewerTier, hasInviteAccess = false) => {
  const isInviteOnly = audience === "INVITE_ONLY";
  const requiresMembership = !!audience && audience !== "ALL" && !isInviteOnly;
  const requiredTier =
    audience === "DOERS_EXCLUSIVE" ? "DOER" : audience === "MEMBERS_ONLY" ? "MEMBER" : null;
  const locked = isInviteOnly
    ? !(viewerTier === "ADMIN" || hasInviteAccess === true)
    : requiresMembership && !tierMeetsAudience(viewerTier, audience);
  return { requiresMembership, requiredTier, locked, isInviteOnly };
};

export const applyViewerPrivacy = (eventObj, reqUser) => {
  if (eventObj.locked || !reqUser?.id) {
    delete eventObj.joinLink;
  }
  return maskCreators(eventObj, reqUser);
};

export const lastTenDigits = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

const phoneVariations = (tenDigits) =>
  tenDigits ? [tenDigits, `+91${tenDigits}`, `91${tenDigits}`, `0${tenDigits}`] : [];

const hasActiveTicket = (tickets) =>
  Object.values(tickets || {}).some((ticket) => ticket && ticket.status === "ACTIVE");

const resolveViewerPhone = async (reqUser) => {
  if (reqUser.phone) return lastTenDigits(reqUser.phone);
  const user = await User.findById(reqUser.id).select("phone").lean();
  return lastTenDigits(user?.phone);
};

export const hasApprovedInviteForPhone = async (eventId, phone) => {
  const tenDigits = lastTenDigits(phone);
  if (!tenDigits) return false;
  const request = await EventRequest.findOne({
    eventId,
    phone: tenDigits,
    status: { $in: INVITE_APPROVED_STATUSES },
    isDeleted: false,
  })
    .select("_id")
    .lean();
  return Boolean(request);
};

export const resolveMockEnrollmentTier = (event, body) => {
  const tiers = event.pricingTiers || [];
  if (tiers.length === 0) {
    return { ticketPrice: event.price == null ? null : event.price, tierName: null };
  }

  let tier = null;
  if (body.tierId) {
    tier = tiers.find((t) => String(t._id) === String(body.tierId));
    if (!tier) {
      return { error: "Invalid tier ID for this event" };
    }
    if (body.tierName && body.tierName !== tier.name) {
      return { error: "Tier name does not match the selected tier" };
    }
  } else if (body.tierName) {
    tier = tiers.find((t) => t.name === body.tierName);
  }

  if (!tier) {
    return { error: "Tier name is required for multi-tier pricing events" };
  }
  return { ticketPrice: tier.price, tierName: tier.name };
};

export const MEMBERS_ONLY_MESSAGE = "This event is for members only. Please become a member to book.";
export const DOERS_ONLY_MESSAGE = "This event is for Doers and Members only. Become a Doer to book.";

export const evaluateBookingAudience = async (event, reqUser) => {
  if (!event.audience || event.audience === "ALL") return { allowed: true };

  const viewerTier = await getAccessTier(reqUser);
  let hasInvite = false;
  if (event.audience === "INVITE_ONLY" && viewerTier !== "ADMIN") {
    hasInvite = await hasApprovedInviteForPhone(event._id, await resolveViewerPhone(reqUser));
  }

  const access = computeEventAccess(event.audience, viewerTier, hasInvite);
  if (!access.locked) return { allowed: true };

  if (access.isInviteOnly) {
    return { allowed: false, message: INVITE_ONLY_MESSAGE, code: INVITE_ONLY_ERROR_CODE };
  }
  return {
    allowed: false,
    message: event.audience === "DOERS_EXCLUSIVE" ? DOERS_ONLY_MESSAGE : MEMBERS_ONLY_MESSAGE,
    code: null,
  };
};

export const getInviteAccessSet = async (eventIds, reqUser, viewerTier) => {
  const result = new Set();
  if (!eventIds || eventIds.length === 0) return result;
  if (!reqUser?.id || reqUser.userType === "admin" || viewerTier === "ADMIN") return result;

  const phone = await resolveViewerPhone(reqUser);
  const variations = phoneVariations(phone);

  const [enrollments, cashEnrollments, requests] = await Promise.all([
    EventEnrollment.find({
      eventId: { $in: eventIds },
      $or: [
        { userId: reqUser.id },
        ...variations.map((p) => ({ [`tickets.${p}`]: { $exists: true } })),
      ],
    })
      .select("eventId tickets")
      .lean(),
    CashEventEnrollment.find({
      eventId: { $in: eventIds },
      status: "ACTIVE",
      isDeleted: { $ne: true },
      $or: [{ userId: reqUser.id }, ...(variations.length ? [{ phone: { $in: variations } }] : [])],
    })
      .select("eventId")
      .lean(),
    phone
      ? EventRequest.find({
          eventId: { $in: eventIds },
          phone,
          status: { $in: INVITE_APPROVED_STATUSES },
          isDeleted: false,
        })
          .select("eventId")
          .lean()
      : [],
  ]);

  enrollments.forEach((e) => {
    if (hasActiveTicket(e.tickets)) result.add(String(e.eventId));
  });
  cashEnrollments.forEach((e) => result.add(String(e.eventId)));
  requests.forEach((r) => result.add(String(r.eventId)));
  return result;
};
