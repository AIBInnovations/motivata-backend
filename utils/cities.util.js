export const mergeCities = (...lists) => {
  const seen = new Map();
  for (const list of lists) {
    for (const raw of list || []) {
      if (typeof raw !== "string") continue;
      const city = raw.trim().replace(/\s+/g, " ");
      if (!city) continue;
      const key = city.toLowerCase();
      if (!seen.has(key)) seen.set(key, city);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
};
