/**
 * @fileoverview Calendly middleware for connection validation
 * @module middleware/calendly
 */

import CalendlyConfig from "../schema/CalendlyConfig.schema.js";
import { decryptToken } from "../utils/calendly.util.js";
import { healthCheck } from "../src/Calendly/calendly.service.js";
import responseUtil from "../utils/response.util.js";

/**
 * Ensure Calendly is connected
 * Attaches decrypted config to req.calendlyConfig
 *
 * @middleware
 */
export const ensureCalendlyConnected = async (req, res, next) => {
  try {
    const config = await CalendlyConfig.getSingletonWithToken();

    if (!config || !config.isConnected) {
      return responseUtil.serviceUnavailable(
        res,
        "Calendly is not connected. Please contact administrator."
      );
    }

    // Decrypt token and attach to request
    const accessToken = decryptToken(config.accessToken);

    req.calendlyConfig = {
      ...config.toObject(),
      accessToken, // Decrypted for use in controllers
    };

    next();
  } catch (error) {
    console.error("[CALENDLY-MIDDLEWARE] ensureCalendlyConnected error:", error);
    return responseUtil.internalError(
      res,
      "Failed to verify Calendly connection",
      error.message
    );
  }
};

/**
 * Validate Calendly token (periodic health check)
 * Only runs if lastValidatedAt is > 24 hours old
 *
 * @middleware
 */
export const validateCalendlyToken = async (req, res, next) => {
  try {
    const config = await CalendlyConfig.getSingletonWithToken();

    if (!config || !config.isConnected) {
      return next(); // Skip if not connected
    }

    // Check if validation is needed (> 24 hours old)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const lastValidated = config.lastValidatedAt
      ? config.lastValidatedAt.getTime()
      : 0;

    if (lastValidated > twentyFourHoursAgo) {
      return next(); // Recently validated, skip
    }

    console.log("[CALENDLY-MIDDLEWARE] Validating token (>24h since last check)");

    // Decrypt and validate token
    const accessToken = decryptToken(config.accessToken);
    const isValid = await healthCheck(accessToken);

    if (isValid) {
      // Update lastValidatedAt
      config.lastValidatedAt = new Date();
      await config.save();
      console.log("[CALENDLY-MIDDLEWARE] Token validated successfully");
    } else {
      // Mark as disconnected
      config.isConnected = false;
      await config.save();
      console.error("[CALENDLY-MIDDLEWARE] Token validation failed - marked as disconnected");

      return responseUtil.serviceUnavailable(
        res,
        "Calendly token is invalid. Please contact administrator to reconnect."
      );
    }

    next();
  } catch (error) {
    console.error("[CALENDLY-MIDDLEWARE] validateCalendlyToken error:", error);
    // Don't block request on validation error
    next();
  }
};

export default {
  ensureCalendlyConnected,
  validateCalendlyToken,
};
