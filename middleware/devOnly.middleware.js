/**
 * @fileoverview Gate for test/mock endpoints.
 * @module middleware/devOnly
 */

import responseUtil from "../utils/response.util.js";

/**
 * Blocks a route in production. Test and mock endpoints are useful in
 * development but must not be reachable in production, where they can leak data
 * or mint records. Returns 404 (not 403) so a probe cannot even tell the route
 * exists on a prod box.
 */
export const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return responseUtil.notFound(
      res,
      "The requested endpoint does not exist"
    );
  }
  next();
};

export default devOnly;
