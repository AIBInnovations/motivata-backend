/**
 * @fileoverview Controller for admin-managed opportunity filter options.
 * @module Job/opportunityFilter.controller
 */

import OpportunityFilter, {
  OPPORTUNITY_FILTER_CATEGORIES,
} from "../../schema/OpportunityFilter.schema.js";
import responseUtil from "../../utils/response.util.js";

/** Empty grouped shape, e.g. { type: [], duration: [], timeline: [], location: [] }. */
const emptyGroups = () =>
  OPPORTUNITY_FILTER_CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: [] }), {});

/**
 * Public (app): get active filter options grouped by category, as plain strings.
 * @route GET /api/app/jobs/filters
 */
export const getOpportunityFilters = async (_req, res) => {
  try {
    const docs = await OpportunityFilter.find({ isActive: true })
      .sort({ category: 1, order: 1, createdAt: 1 })
      .lean();

    const groups = emptyGroups();
    for (const d of docs) {
      if (groups[d.category]) groups[d.category].push(d.value);
    }

    return responseUtil.success(res, "Opportunity filters fetched successfully", {
      filters: groups,
    });
  } catch (error) {
    console.error("[OPP-FILTER] Get filters error:", error);
    return responseUtil.internalError(res, "Failed to fetch filters", error.message);
  }
};

/**
 * Admin: list all filter options grouped by category, with ids (for management).
 * @route GET /api/web/jobs/filters
 */
export const listOpportunityFilters = async (_req, res) => {
  try {
    const docs = await OpportunityFilter.find({})
      .sort({ category: 1, order: 1, createdAt: 1 })
      .lean();

    const groups = emptyGroups();
    for (const d of docs) {
      if (groups[d.category]) {
        groups[d.category].push({
          _id: d._id,
          value: d.value,
          order: d.order,
          isActive: d.isActive,
        });
      }
    }

    return responseUtil.success(res, "Opportunity filters fetched successfully", {
      filters: groups,
    });
  } catch (error) {
    console.error("[OPP-FILTER] List filters error:", error);
    return responseUtil.internalError(res, "Failed to fetch filters", error.message);
  }
};

/**
 * Admin: add a filter option.
 * @route POST /api/web/jobs/filters
 * @body {string} category - one of type|duration|timeline|location
 * @body {string} value
 */
export const createOpportunityFilter = async (req, res) => {
  try {
    const { category, value } = req.body;

    if (!OPPORTUNITY_FILTER_CATEGORIES.includes(category)) {
      return responseUtil.badRequest(
        res,
        `Category must be one of: ${OPPORTUNITY_FILTER_CATEGORIES.join(", ")}`
      );
    }
    if (!value || !value.trim()) {
      return responseUtil.badRequest(res, "Filter value is required");
    }

    // Place new option at the end of its category.
    const last = await OpportunityFilter.findOne({ category })
      .sort({ order: -1 })
      .select("order")
      .lean();
    const order = (last?.order ?? -1) + 1;

    const filter = await OpportunityFilter.create({
      category,
      value: value.trim(),
      order,
    });

    return responseUtil.created(res, "Filter option added successfully", { filter });
  } catch (error) {
    if (error.code === 11000) {
      return responseUtil.conflict(res, "That option already exists in this category");
    }
    console.error("[OPP-FILTER] Create filter error:", error);
    return responseUtil.internalError(res, "Failed to add filter option", error.message);
  }
};

/**
 * Admin: remove a filter option.
 * @route DELETE /api/web/jobs/filters/:id
 */
export const deleteOpportunityFilter = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await OpportunityFilter.findByIdAndDelete(id);
    if (!deleted) {
      return responseUtil.notFound(res, "Filter option not found");
    }
    return responseUtil.success(res, "Filter option removed successfully");
  } catch (error) {
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid filter ID");
    }
    console.error("[OPP-FILTER] Delete filter error:", error);
    return responseUtil.internalError(res, "Failed to remove filter option", error.message);
  }
};
