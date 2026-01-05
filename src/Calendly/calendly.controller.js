/**
 * @fileoverview Calendly controller for managing PAT and fetching slots
 * @module controllers/calendly
 */

import CalendlyConfig from "../../schema/CalendlyConfig.schema.js";
import responseUtil from "../../utils/response.util.js";
import {
  encryptToken,
  decryptToken,
  cacheSlots,
  getCachedSlots,
  clearAllCache,
  generateSlotsCacheKey,
} from "../../utils/calendly.util.js";
import {
  validateToken,
  fetchEventTypes,
  fetchAvailableSlots,
} from "./calendly.service.js";

/**
 * Configure Calendly using public URLs (Free plan compatible)
 *
 * @route POST /api/web/calendly/configure-public
 * @access Admin
 */
export const configurePublic = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] configurePublic called");

    const { calendlyUsername, eventTypes } = req.body;
    const adminId = req.user.id;

    if (!calendlyUsername) {
      return responseUtil.badRequest(res, "Calendly username is required");
    }

    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return responseUtil.badRequest(
        res,
        "At least one event type is required"
      );
    }

    // Validate event types format
    for (const et of eventTypes) {
      if (!et.name || !et.slug) {
        return responseUtil.badRequest(
          res,
          "Each event type must have a name and slug"
        );
      }
    }

    // Get or create singleton config
    let config = await CalendlyConfig.getSingleton();

    // Update config for public mode
    config.connectionMode = "public";
    config.isConnected = true;
    config.calendlyUsername = calendlyUsername;
    config.connectedBy = adminId;
    config.connectedAt = new Date();
    config.lastSyncedAt = new Date();

    // Format event types with public URLs
    config.eventTypes = eventTypes.map((et) => ({
      uri: `https://calendly.com/${calendlyUsername}/${et.slug}`, // Public URL as URI
      name: et.name,
      slug: et.slug,
      active: true,
      duration: et.duration || 30,
      schedulingUrl: `https://calendly.com/${calendlyUsername}/${et.slug}`,
    }));

    await config.save();

    // Clear all cached slots
    clearAllCache();

    console.log("[CALENDLY-CONTROLLER] Calendly configured (public mode)");

    return responseUtil.created(res, "Calendly configured successfully (public mode)", {
      calendlyUsername,
      eventTypesCount: config.eventTypes.length,
      connectedAt: config.connectedAt,
      mode: "public",
    });
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] configurePublic error:", error);
    return responseUtil.internalError(
      res,
      "Failed to configure Calendly",
      error.message
    );
  }
};

/**
 * Save/Update Personal Access Token (Paid plan only)
 *
 * @route POST /api/web/calendly/token
 * @access Admin
 */
export const saveToken = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] saveToken called");

    const { accessToken } = req.body;
    const adminId = req.user.id;

    if (!accessToken) {
      return responseUtil.badRequest(res, "Personal Access Token is required");
    }

    // Validate token with Calendly API
    console.log("[CALENDLY-CONTROLLER] Validating token with Calendly...");
    let userInfo;
    try {
      userInfo = await validateToken(accessToken);
    } catch (error) {
      console.error("[CALENDLY-CONTROLLER] Token validation failed:", error.message);
      return responseUtil.unauthorized(
        res,
        error.message || "Invalid Personal Access Token. Please check and try again."
      );
    }

    // Extract user details
    const calendlyUserId = userInfo.uri;
    const calendlyOrganizationUri = userInfo.current_organization;

    if (!calendlyOrganizationUri) {
      return responseUtil.badRequest(
        res,
        "No organization found for this Calendly account"
      );
    }

    // Fetch event types
    console.log("[CALENDLY-CONTROLLER] Fetching event types...");
    let eventTypes = [];
    try {
      eventTypes = await fetchEventTypes(accessToken, calendlyOrganizationUri);
    } catch (error) {
      console.error("[CALENDLY-CONTROLLER] Fetch event types failed:", error.message);
      // Continue even if event types fetch fails - can sync later
    }

    // Encrypt token
    const encryptedToken = encryptToken(accessToken);

    // Get or create singleton config
    let config = await CalendlyConfig.getSingletonWithToken();

    // Update config for PAT mode
    config.connectionMode = "pat";
    config.isConnected = true;
    config.accessToken = encryptedToken;
    config.calendlyUserId = calendlyUserId;
    config.calendlyOrganizationUri = calendlyOrganizationUri;
    config.connectedBy = adminId;
    config.connectedAt = new Date();
    config.lastSyncedAt = new Date();
    config.lastValidatedAt = new Date();
    config.eventTypes = eventTypes;

    await config.save();

    // Clear all cached slots since we have new token
    clearAllCache();

    console.log("[CALENDLY-CONTROLLER] Calendly connected successfully");

    return responseUtil.created(res, "Calendly connected successfully", {
      calendlyUserId,
      eventTypesCount: eventTypes.length,
      connectedAt: config.connectedAt,
    });
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] saveToken error:", error);
    return responseUtil.internalError(
      res,
      "Failed to save Calendly token",
      error.message
    );
  }
};

/**
 * Get connection status
 *
 * @route GET /api/web/calendly/connection/status
 * @access Admin
 */
export const getConnectionStatus = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] getConnectionStatus called");

    const config = await CalendlyConfig.getSingleton();

    if (!config || !config.isConnected) {
      return responseUtil.success(res, "Calendly not connected", {
        connected: false,
      });
    }

    return responseUtil.success(res, "Calendly connection status retrieved", {
      connected: true,
      connectionMode: config.connectionMode || "public",
      calendlyUsername: config.calendlyUsername,
      calendlyUserId: config.calendlyUserId,
      organizationUri: config.calendlyOrganizationUri,
      eventTypes: config.eventTypes,
      connectedAt: config.connectedAt,
      lastSyncedAt: config.lastSyncedAt,
      lastValidatedAt: config.lastValidatedAt,
    });
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] getConnectionStatus error:", error);
    return responseUtil.internalError(
      res,
      "Failed to retrieve connection status",
      error.message
    );
  }
};

/**
 * Disconnect Calendly (remove token and config)
 *
 * @route POST /api/web/calendly/connection/disconnect
 * @access Super Admin
 */
export const disconnectCalendly = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] disconnectCalendly called");

    const config = await CalendlyConfig.getSingleton();

    if (!config || !config.isConnected) {
      return responseUtil.badRequest(res, "Calendly is not connected");
    }

    // Reset config instead of deleting (maintain singleton)
    config.connectionMode = "public";
    config.isConnected = false;
    config.accessToken = null;
    config.calendlyUsername = null;
    config.calendlyUserId = null;
    config.calendlyOrganizationUri = null;
    config.eventTypes = [];
    config.lastSyncedAt = null;
    config.lastValidatedAt = null;

    await config.save();

    // Clear all cached slots
    clearAllCache();

    console.log("[CALENDLY-CONTROLLER] Calendly disconnected successfully");

    return responseUtil.success(
      res,
      "Calendly connection removed successfully"
    );
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] disconnectCalendly error:", error);
    return responseUtil.internalError(
      res,
      "Failed to disconnect Calendly",
      error.message
    );
  }
};

/**
 * Sync event types from Calendly
 *
 * @route POST /api/web/calendly/event-types/sync
 * @access Admin
 */
export const syncEventTypes = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] syncEventTypes called");

    const config = await CalendlyConfig.getSingletonWithToken();

    if (!config || !config.isConnected) {
      return responseUtil.badRequest(res, "Calendly is not connected");
    }

    // Decrypt token
    const accessToken = decryptToken(config.accessToken);

    // Fetch event types
    console.log("[CALENDLY-CONTROLLER] Fetching event types from Calendly...");
    let eventTypes;
    try {
      eventTypes = await fetchEventTypes(
        accessToken,
        config.calendlyOrganizationUri
      );
    } catch (error) {
      console.error("[CALENDLY-CONTROLLER] Sync event types failed:", error.message);

      // If token is invalid, mark as disconnected
      if (error.message.includes("Invalid") || error.message.includes("expired")) {
        config.isConnected = false;
        await config.save();
        return responseUtil.unauthorized(
          res,
          "Calendly token is invalid. Please reconnect."
        );
      }

      throw error;
    }

    // Update config
    config.eventTypes = eventTypes;
    config.lastSyncedAt = new Date();
    config.lastValidatedAt = new Date();

    await config.save();

    console.log(
      `[CALENDLY-CONTROLLER] Synced ${eventTypes.length} event types`
    );

    return responseUtil.success(res, "Event types synced successfully", {
      eventTypes,
      syncedAt: config.lastSyncedAt,
    });
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] syncEventTypes error:", error);
    return responseUtil.internalError(
      res,
      "Failed to sync event types",
      error.message
    );
  }
};

/**
 * Get available slots for an event type (PUBLIC endpoint)
 *
 * @route GET /api/app/calendly/slots/:eventTypeUri
 * @access Public (no auth required)
 */
export const getAvailableSlots = async (req, res) => {
  try {
    console.log("[CALENDLY-CONTROLLER] getAvailableSlots called");

    const { eventTypeUri } = req.params;
    const { start_date, end_date } = req.query;

    // Decode URI-encoded event type URI
    const decodedEventTypeUri = decodeURIComponent(eventTypeUri);

    // Default date range: today to 30 days from now
    const startDate =
      start_date || new Date().toISOString().split("T")[0];
    const endDate =
      end_date ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    // Check cache first
    const cacheKey = generateSlotsCacheKey(
      decodedEventTypeUri,
      startDate,
      endDate
    );
    const cachedData = getCachedSlots(cacheKey);

    if (cachedData) {
      return responseUtil.success(res, "Available slots retrieved (cached)", {
        eventTypeUri: decodedEventTypeUri,
        slots: cachedData,
        cached: true,
        cachedAt: new Date(),
      });
    }

    // Check if Calendly is connected
    const config = await CalendlyConfig.getSingletonWithToken();

    if (!config || !config.isConnected) {
      console.warn("[CALENDLY-CONTROLLER] Calendly not connected");
      return responseUtil.serviceUnavailable(
        res,
        "Calendly is not connected. Please contact administrator."
      );
    }

    // In public mode, return the Calendly embed URL instead of API slots
    if (config.connectionMode === "public") {
      console.log("[CALENDLY-CONTROLLER] Public mode - returning embed URL");
      return responseUtil.success(res, "Calendly booking URL (public mode)", {
        eventTypeUri: decodedEventTypeUri,
        calendlyUrl: decodedEventTypeUri, // The public Calendly URL
        mode: "public",
        message: "Use this URL to embed Calendly widget or redirect users for booking",
        embedInstructions: {
          iframe: `<iframe src="${decodedEventTypeUri}" width="100%" height="600px" frameborder="0"></iframe>`,
          redirect: `window.location.href = "${decodedEventTypeUri}"`,
        },
      });
    }

    // Decrypt token
    const accessToken = decryptToken(config.accessToken);

    // Fetch slots from Calendly API
    console.log("[CALENDLY-CONTROLLER] Fetching slots from Calendly API...");
    let slots;
    try {
      slots = await fetchAvailableSlots(
        accessToken,
        decodedEventTypeUri,
        startDate,
        endDate
      );
    } catch (error) {
      console.error("[CALENDLY-CONTROLLER] Fetch slots failed:", error.message);

      // If token is invalid, mark as disconnected
      if (
        error.message.includes("Invalid") ||
        error.message.includes("expired")
      ) {
        config.isConnected = false;
        await config.save();
        return responseUtil.serviceUnavailable(
          res,
          "Calendly connection is invalid. Please contact administrator."
        );
      }

      // If rate limited, return empty array
      if (error.message.includes("Rate limit")) {
        return responseUtil.success(
          res,
          "Calendly API rate limit exceeded. Please try again later.",
          {
            eventTypeUri: decodedEventTypeUri,
            slots: [],
            cached: false,
            error: "rate_limit",
          }
        );
      }

      // Generic error - return empty slots
      return responseUtil.success(
        res,
        "Failed to fetch slots from Calendly",
        {
          eventTypeUri: decodedEventTypeUri,
          slots: [],
          cached: false,
          error: "fetch_failed",
        }
      );
    }

    // Cache the slots
    const cacheTTL = parseInt(process.env.CALENDLY_SLOTS_CACHE_TTL || "300", 10);
    cacheSlots(cacheKey, slots, cacheTTL);

    // Update last validated timestamp
    config.lastValidatedAt = new Date();
    await config.save();

    return responseUtil.success(res, "Available slots retrieved", {
      eventTypeUri: decodedEventTypeUri,
      slots,
      cached: false,
    });
  } catch (error) {
    console.error("[CALENDLY-CONTROLLER] getAvailableSlots error:", error);
    return responseUtil.internalError(
      res,
      "Failed to retrieve available slots",
      error.message
    );
  }
};

/**
 * Get available slots using public scheduling URL (no PAT required)
 *
 * @route GET /api/app/calendly/slots/public
 * @access Public (no auth required)
 */
export default {
  configurePublic,
  saveToken,
  getConnectionStatus,
  disconnectCalendly,
  syncEventTypes,
  getAvailableSlots,
};
