/**
 * @fileoverview OpportunityFilter schema — admin-managed filter options for the
 * Doer's Club / Opportunities feature. One document per option, grouped by
 * `category` (type / duration / timeline / location). Admins add/remove options
 * and the mobile app's Doers tab renders whatever is configured here.
 * @module schema/OpportunityFilter
 */

import mongoose from "mongoose";

/** The filter groups an option can belong to. */
export const OPPORTUNITY_FILTER_CATEGORIES = ["type", "duration", "timeline", "location"];

const opportunityFilterSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: OPPORTUNITY_FILTER_CATEGORIES,
      index: true,
    },
    value: {
      type: String,
      required: [true, "Filter value is required"],
      trim: true,
      maxlength: [100, "Filter value cannot exceed 100 characters"],
    },
    /** Display order within its category (lower first). */
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// No duplicate value within the same category (case-sensitive as stored).
opportunityFilterSchema.index({ category: 1, value: 1 }, { unique: true });
opportunityFilterSchema.index({ category: 1, order: 1, createdAt: 1 });

const OpportunityFilter = mongoose.model("OpportunityFilter", opportunityFilterSchema);
export default OpportunityFilter;
