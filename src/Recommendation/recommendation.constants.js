/**
 * @fileoverview Shared constants for the Recommendation feature.
 * Single source of truth for predefined tags and limits, used by the schema,
 * validation, and the public tags endpoint.
 * @module Recommendation/constants
 */

/**
 * Recommendation taxonomy: a Main category with its Sub Tags.
 * A recommendation is stored as [mainCategory, subTag] (1 main + at most 1 sub).
 * Edit this list to change the available tags everywhere.
 */
export const RECOMMENDATION_CATEGORIES = [
  {
    name: "Entertainment",
    tags: [
      "Movie", "Series", "Show", "Documentary", "Music", "Album", "Podcast",
      "Episode", "Stand-Up", "Comedy", "Game", "Short Film", "YouTube", "Creator",
    ],
  },
  {
    name: "Food & Drink",
    tags: [
      "Restaurant", "Café", "Street Food", "Dish", "Recipe", "Dessert", "Drink",
      "Beverage", "Healthy Eat", "Home Cooked", "Hidden Gem",
    ],
  },
  {
    name: "Read",
    tags: [
      "Book", "Article", "Newsletter", "Essay", "Biography", "Self-help",
      "Fiction", "Non-fiction", "Comic", "Graphic Novel", "Thread", "Post",
    ],
  },
  {
    name: "Product",
    tags: [
      "Tech", "Gadget", "Skincare", "Beauty", "Fashion", "Clothing", "Fitness Gear",
      "Home & Living", "Stationery", "App", "Tool", "Wellness", "Sustainable",
    ],
  },
  {
    name: "Experience",
    tags: [
      "Travel Spot", "Event", "Concert", "Workshop", "Course", "Outdoor Activity",
      "Wellness Retreat", "Museum", "Exhibition", "Local Hidden Spot", "Festival",
      "Spiritual", "Mindful",
    ],
  },
  {
    name: "Growth",
    tags: [
      "Daily Habit", "Morning Routine", "Mental Health", "Productivity", "Mindfulness",
      "Meditation", "Fitness", "Movement", "Nutrition", "Skill Learning", "Financial",
      "Habit", "Journalling",
    ],
  },
  {
    name: "Career & Work",
    tags: [
      "Tool", "Software", "Freelancing", "Entrepreneurship", "Leadership", "Side Hustle",
      "Interview", "Job Hunt", "Design", "Creative", "Marketing", "Finance", "Investing",
    ],
  },
  {
    name: "People & Voices",
    tags: [
      "Creator", "Influencer", "Author", "Speaker", "Coach", "Spiritual Teacher",
      "Entrepreneur", "Artist", "Musician", "Athlete", "Scientist", "Thinker", "Doer",
    ],
  },
];

/** The 8 main category names — used for the Explore filter chips. */
export const RECOMMENDATION_MAIN_TAGS = RECOMMENDATION_CATEGORIES.map((c) => c.name);

/**
 * Flat union of every valid tag (main categories + all sub-tags), de-duplicated.
 * Used by validation to allow any of these on a recommendation or as a filter.
 */
export const RECOMMENDATION_TAGS = [
  ...new Set([
    ...RECOMMENDATION_MAIN_TAGS,
    ...RECOMMENDATION_CATEGORIES.flatMap((c) => c.tags),
  ]),
];

/** Maximum number of words allowed in a recommendation's text. */
export const RECOMMENDATION_MAX_WORDS = 50;

/** Maximum number of words allowed in a comment. */
export const COMMENT_MAX_WORDS = 25;

/** Maximum number of tags that can be attached to a recommendation. */
export const RECOMMENDATION_MAX_TAGS = 2;

export const MAX_PINNED_COMMENTS = 5;

const SIMILARITY_STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "this", "that", "with", "was", "are", "have", "has",
  "its", "it's", "from", "must", "should", "watch", "read", "try", "best", "good", "great",
  "very", "really", "one", "all", "our", "who", "what", "when", "will", "can", "just", "about",
  "out", "but", "not", "they", "them", "their", "his", "her", "she", "him", "love", "loved",
  "recommend", "recommended", "highly", "amazing", "awesome", "nice", "also", "into", "over",
]);

export const tokenizeForSimilarity = (text = "") =>
  new Set(
    String(text)
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !SIMILARITY_STOP_WORDS.has(w))
  );

export const similarityScore = (a, b) => {
  if (a.size === 0 || b.size === 0) return { shared: 0, score: 0 };
  let shared = 0;
  a.forEach((w) => {
    if (b.has(w)) shared += 1;
  });
  return { shared, score: shared / Math.min(a.size, b.size) };
};

/**
 * Membership plan name(s) whose buyers count as "Doers" (allowed to bookmark).
 *
 * TODO: Set this to the exact membership plan name that designates a Doer,
 * e.g. ["Motivata Membership"]. While this list is EMPTY, any user with an
 * active membership is treated as a Doer (interim behaviour for testing).
 */
export const DOER_PLAN_NAMES = [];

/**
 * Count words in a string (whitespace-separated, ignoring empty tokens).
 * @param {string} text
 * @returns {number}
 */
export const countWords = (text = "") =>
  String(text).trim().split(/\s+/).filter(Boolean).length;
