import FeatureAccess from '../../schema/FeatureAccess.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import UserFeatureAccess from '../../schema/UserFeatureAccess.schema.js';
import FeaturePricing from '../../schema/FeaturePricing.schema.js';

export const PARENT_FEATURE = {
  SOS_INTENSIVE: 'SOS',
};

const daysLeft = (isLifetime, endDate) =>
  isLifetime ? Infinity : Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

export const resolveFeatureAccess = async (featureKey, phone) => {
  const requestedKey = String(featureKey || '').toUpperCase();
  const normalizedPhone = String(phone || '').slice(-10);

  const feature = await FeatureAccess.findOne({ featureKey: requestedKey });

  if (!feature || !feature.isActive) {
    return {
      hasAccess: false,
      reason: 'FEATURE_INACTIVE',
      message: 'This feature is currently unavailable',
    };
  }

  if (!feature.requiresMembership) {
    return {
      hasAccess: true,
      reason: 'OPEN_TO_ALL',
      message: 'Access granted',
    };
  }

  const membership = await UserMembership.findOne({
    phone: normalizedPhone,
    isDeleted: false,
    status: 'ACTIVE',
    $or: [
      { isLifetime: true },
      { endDate: null },
      { endDate: { $lte: new Date(1000) } },
      { endDate: { $gte: new Date() } },
    ],
  }).populate('membershipPlanId');

  if (membership) {
    return {
      hasAccess: true,
      reason: 'MEMBERSHIP_VALID',
      accessType: 'FULL_MEMBERSHIP',
      message: 'Access granted via full membership',
      membership: {
        planName: membership.membershipPlanId?.name || 'Full Membership',
        endDate: membership.isLifetime ? null : membership.endDate,
        daysRemaining: daysLeft(membership.isLifetime, membership.endDate),
        isLifetime: membership.isLifetime,
      },
    };
  }

  const acceptedKeys = PARENT_FEATURE[requestedKey]
    ? [requestedKey, PARENT_FEATURE[requestedKey]]
    : [requestedKey];

  const featureAccess = await UserFeatureAccess.findOne({
    phone: normalizedPhone,
    featureKey: { $in: acceptedKeys },
    isDeleted: false,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    startDate: { $lte: new Date() },
    $or: [{ isLifetime: true }, { endDate: { $gt: new Date() } }],
  });

  if (featureAccess) {
    return {
      hasAccess: true,
      reason: 'FEATURE_ACCESS_VALID',
      accessType: 'INDIVIDUAL_FEATURE',
      message: 'Access granted via individual feature purchase',
      featureAccess: {
        featureKey: featureAccess.featureKey,
        endDate: featureAccess.isLifetime ? null : featureAccess.endDate,
        daysRemaining: daysLeft(featureAccess.isLifetime, featureAccess.endDate),
        isLifetime: featureAccess.isLifetime,
      },
    };
  }

  const pricing = await FeaturePricing.findByFeatureKey(requestedKey);
  return {
    hasAccess: false,
    reason: 'NO_ACCESS',
    message: pricing
      ? 'This feature requires a membership or individual purchase'
      : 'This feature requires a membership',
    purchaseOptions: {
      fullMembership: true,
      individualFeature: !!pricing,
    },
  };
};

export default { resolveFeatureAccess, PARENT_FEATURE };
