export const SOS_REFLECTION_POINTS_EACH = 5;
export const SOS_REFLECTION_POINTS_CAP = 30;
export const SOS_SIMPLE_POINTS = 100;
export const SOS_INTENSIVE_POINTS = 150;
export const SOS_INTENSIVE_PER_DAY = 15;
export const SOS_INTENSIVE_IN_PROGRESS_CAP = 105;
export const SOS_CATEGORY_CAP = SOS_SIMPLE_POINTS + SOS_INTENSIVE_POINTS + SOS_REFLECTION_POINTS_CAP;

export const CONNECTION_POINTS_EACH = 5;
export const CONNECTION_POINTS_CAP = 25;
export const RECOMMENDATION_POINTS_EACH = 10;
export const RECOMMENDATION_POINTS_CAP = 25;
export const WEEKLY_UPDATE_POINTS_EACH = 10;
export const WEEKLY_UPDATE_POINTS_CAP = 50;
export const CLUB_JOIN_POINTS_EACH = 10;
export const CLUB_JOIN_MAX_CLUBS = 3;
export const CLUB_ACTIVE_POINTS = 5;
export const COMMUNITY_CATEGORY_CAP =
  CONNECTION_POINTS_CAP +
  RECOMMENDATION_POINTS_CAP +
  WEEKLY_UPDATE_POINTS_CAP +
  CLUB_JOIN_POINTS_EACH * CLUB_JOIN_MAX_CLUBS +
  CLUB_ACTIVE_POINTS;

const safe = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);

const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));

export const computeSosPoints = ({
  simpleDone = false,
  intensiveDone = false,
  intensiveDaysCompleted = 0,
  reflectionCount = 0,
} = {}) => {
  let points = 0;
  if (simpleDone) points += SOS_SIMPLE_POINTS;
  if (intensiveDone) {
    points += SOS_INTENSIVE_POINTS;
  } else {
    points += Math.min(SOS_INTENSIVE_IN_PROGRESS_CAP, safe(intensiveDaysCompleted) * SOS_INTENSIVE_PER_DAY);
  }
  points += Math.min(SOS_REFLECTION_POINTS_CAP, safe(reflectionCount) * SOS_REFLECTION_POINTS_EACH);
  return clamp(points, SOS_CATEGORY_CAP);
};

export const computeCommunityPoints = ({
  connections = 0,
  recommendations = 0,
  weeklyUpdates = 0,
  clubsJoined = 0,
  clubActive = false,
} = {}) => {
  const clubs = Math.floor(safe(clubsJoined));
  const points =
    Math.min(CONNECTION_POINTS_CAP, safe(connections) * CONNECTION_POINTS_EACH) +
    Math.min(RECOMMENDATION_POINTS_CAP, safe(recommendations) * RECOMMENDATION_POINTS_EACH) +
    Math.min(WEEKLY_UPDATE_POINTS_CAP, safe(weeklyUpdates) * WEEKLY_UPDATE_POINTS_EACH) +
    Math.min(CLUB_JOIN_MAX_CLUBS, clubs) * CLUB_JOIN_POINTS_EACH +
    (clubs > 0 && clubActive === true ? CLUB_ACTIVE_POINTS : 0);
  return clamp(points, COMMUNITY_CATEGORY_CAP);
};
