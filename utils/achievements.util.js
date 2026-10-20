export const ACHIEVEMENT_MAX_ITEMS = 10;
export const ACHIEVEMENT_MAX_CHARS = 200;
export const LEGACY_ACHIEVEMENT_MAX_CHARS = 500;

export const normalizeAchievements = (value) => {
  if (!Array.isArray(value)) return [];
  const cleaned = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    cleaned.push(text.slice(0, ACHIEVEMENT_MAX_CHARS));
  }
  return cleaned;
};

export const legacyAchievementFrom = (achievements) => {
  if (!achievements.length) return null;
  return achievements.join("\n").slice(0, LEGACY_ACHIEVEMENT_MAX_CHARS);
};

export const deriveAchievements = (user) => {
  const stored = normalizeAchievements(user?.achievements);
  if (stored.length) return stored.slice(0, ACHIEVEMENT_MAX_ITEMS);
  const legacy = typeof user?.achievement === "string" ? user.achievement : "";
  return normalizeAchievements(legacy.split(/\r?\n/)).slice(0, ACHIEVEMENT_MAX_ITEMS);
};
