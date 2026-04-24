/**
 * @fileoverview Preset icon catalog for challenges and tasks.
 * Admin panel picks one of these keys; the key is stored on Challenge.icon
 * and Task.icon. The actual icon files live under /assets/icons/<key>.svg
 * and are served by express.static.
 * @module Challenge/icons
 */

/**
 * Ordered list of preset icons. Add/remove entries here to change what the
 * admin picker shows — schema enum and Joi validator derive from ICON_KEYS.
 */
export const CHALLENGE_ICONS = [
  { key: "target", label: "Target" },
  { key: "book", label: "Book" },
  { key: "heart", label: "Heart" },
  { key: "dumbbell", label: "Dumbbell" },
  { key: "meditation", label: "Meditation" },
  { key: "water-drop", label: "Water" },
  { key: "sleep", label: "Sleep" },
  { key: "sun", label: "Sun" },
  { key: "moon", label: "Moon" },
  { key: "fire", label: "Streak" },
  { key: "star", label: "Star" },
  { key: "trophy", label: "Trophy" },
  { key: "checklist", label: "Checklist" },
  { key: "pencil", label: "Journal" },
  { key: "calendar", label: "Calendar" },
];

export const ICON_KEYS = CHALLENGE_ICONS.map((i) => i.key);

/**
 * Build the public URL for an icon key. Returns null for unknown keys so
 * callers can decide whether to fall back.
 * @param {string} key
 * @returns {string|null}
 */
export const getIconUrl = (key) => {
  if (!key || !ICON_KEYS.includes(key)) return null;
  return `/assets/icons/${key}.svg`;
};

/**
 * Returns the full catalog with resolved URLs — shape consumed by the
 * admin panel icon picker.
 */
export const getIconCatalog = () =>
  CHALLENGE_ICONS.map((icon) => ({
    ...icon,
    url: getIconUrl(icon.key),
  }));

export default {
  CHALLENGE_ICONS,
  ICON_KEYS,
  getIconUrl,
  getIconCatalog,
};
