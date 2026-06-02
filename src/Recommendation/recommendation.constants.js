/**
 * @fileoverview Shared constants for the Recommendation feature.
 * Single source of truth for predefined tags and limits, used by the schema,
 * validation, and the public tags endpoint.
 * @module Recommendation/constants
 */

/**
 * Recommendation taxonomy: a Main category with its Sub Tags.
 * A recommendation is stored as [mainCategory, ...subTags] (1 main + up to 2 subs).
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
export const RECOMMENDATION_MAX_TAGS = 3;

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
