export const CONTENT_CATEGORIES = [
  "Entertainment",
  "Lifestyle",
  "Relationship",
  "Experience",
  "Growth",
  "Finance",
  "Career & Work",
  "People",
  "Others",
];

export const CONTENT_MAX_WORDS = 100;

export const countContentWords = (text = "") =>
  String(text).trim().split(/\s+/).filter(Boolean).length;
