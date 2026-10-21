import Joi from "joi";
import { CONTENT_CATEGORIES } from "../Connect/content.constants.js";
import { RECOMMENDATION_MAIN_TAGS } from "../Recommendation/recommendation.constants.js";

const RECOMMENDATION_TO_POST = { "People & Voices": "People" };
const POST_TO_RECOMMENDATION = { People: "People & Voices" };

export const EXPLORE_CATEGORIES = [
  ...new Set([...CONTENT_CATEGORIES, ...RECOMMENDATION_MAIN_TAGS]),
];

export const resolveExploreCategory = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  const canonical = EXPLORE_CATEGORIES.find((name) => name.toLowerCase() === raw);
  if (!canonical) return null;

  const postCategory = CONTENT_CATEGORIES.includes(canonical)
    ? canonical
    : RECOMMENDATION_TO_POST[canonical] || null;
  const recommendationTag = RECOMMENDATION_MAIN_TAGS.includes(canonical)
    ? canonical
    : POST_TO_RECOMMENDATION[canonical] || null;

  return { canonical, postCategory, recommendationTag };
};

export const exploreCategoryQuery = Joi.string()
  .trim()
  .max(50)
  .allow("")
  .custom((value, helpers) => {
    const resolved = resolveExploreCategory(value);
    if (!resolved) return helpers.error("any.invalid");
    return resolved.canonical;
  })
  .messages({
    "any.invalid": `Category must be one of: ${EXPLORE_CATEGORIES.join(", ")}`,
  });
