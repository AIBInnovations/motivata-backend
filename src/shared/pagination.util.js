/**
 * @fileoverview Shared pagination utility for consistent pagination across modules
 * @module shared/pagination
 */

/**
 * Builds pagination options for Mongoose queries
 * @param {Object} query - Request query params
 * @param {Object} defaults - Default values for pagination
 * @returns {Object} { skip, limit, sort, page }
 */
export const buildPaginationOptions = (query, defaults = {}) => {
  const page = Math.max(1, parseInt(query.page) || defaults.page || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaults.limit || 10));
  const skip = (page - 1) * limit;

  const sortField = query.sortBy || defaults.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;
  const sort = { [sortField]: sortOrder };

  return { skip, limit, sort, page };
};

/**
 * Builds pagination metadata for response
 * @param {number} total - Total count of documents
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    page,
    currentPage: page,
    limit,
    total,
    totalCount: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

export default {
  buildPaginationOptions,
  buildPaginationMeta
};
