export const CHALLENGE_CATEGORIES = [
  {
    key: "personal",
    label: "Personal",
    subCategories: [
      { key: "mental_health", label: "Mental Health" },
      { key: "physical_health", label: "Physical Health" },
      { key: "self_awareness", label: "Self-Awareness" },
      { key: "recreation", label: "Recreation" },
      { key: "learning", label: "Learning" },
    ],
  },
  {
    key: "professional",
    label: "Professional",
    subCategories: [
      { key: "discipline", label: "Discipline" },
      { key: "growth", label: "Growth" },
      { key: "productivity", label: "Productivity" },
      { key: "efficiency", label: "Efficiency" },
      { key: "finance", label: "Finance" },
    ],
  },
  {
    key: "relational",
    label: "Relational",
    subCategories: [
      { key: "society", label: "Society" },
      { key: "family", label: "Family" },
      { key: "friendship", label: "Friendship" },
      { key: "romance", label: "Romance" },
      { key: "communication", label: "Communication" },
    ],
  },
];

export const CATEGORY_KEYS = CHALLENGE_CATEGORIES.map((c) => c.key);

export const SUB_CATEGORY_KEYS = CHALLENGE_CATEGORIES.flatMap((c) =>
  c.subCategories.map((s) => s.key)
);

export const SUB_CATEGORY_KEYS_BY_CATEGORY = CHALLENGE_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.subCategories.map((s) => s.key);
  return acc;
}, {});

export const isSubCategoryOfCategory = (category, subCategory) => {
  if (!category || !subCategory) return false;
  return (SUB_CATEGORY_KEYS_BY_CATEGORY[category] || []).includes(subCategory);
};

export const getCategoryCatalog = () => CHALLENGE_CATEGORIES;

export default {
  CHALLENGE_CATEGORIES,
  CATEGORY_KEYS,
  SUB_CATEGORY_KEYS,
  SUB_CATEGORY_KEYS_BY_CATEGORY,
  isSubCategoryOfCategory,
  getCategoryCatalog,
};
