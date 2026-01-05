/**
 * @fileoverview Calendly API service layer for interacting with Calendly REST API
 * @module services/calendly
 */

import axios from "axios";

const CALENDLY_API_BASE_URL =
  process.env.CALENDLY_API_BASE_URL || "https://api.calendly.com";

/**
 * Create axios instance with default config
 * @param {string} accessToken - Personal Access Token
 * @returns {axios.AxiosInstance}
 */
const createCalendlyClient = (accessToken) => {
  return axios.create({
    baseURL: CALENDLY_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 10000, // 10 seconds
  });
};


/**
 * Exponential backoff retry wrapper
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<any>}
 */
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const shouldRetry =
        error.response?.status >= 500 || error.code === "ECONNREFUSED";

      if (isLastAttempt || !shouldRetry) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(
        `[CALENDLY-SERVICE] Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};


/**
 * Validate token and fetch user info
 * @param {string} accessToken - Personal Access Token
 * @returns {Promise<Object>} User info from Calendly
 * @throws {Error} If token is invalid or API call fails
 */
export const validateToken = async (accessToken) => {
  console.log("[CALENDLY-SERVICE] Validating token...");

  try {
    const client = createCalendlyClient(accessToken);

    const response = await retryWithBackoff(() => client.get("/users/me"));

    console.log("[CALENDLY-SERVICE] Token validated successfully");
    return response.data.resource;
  } catch (error) {
    console.error("[CALENDLY-SERVICE] Token validation failed:", error.message);

    if (error.response?.status === 401) {
      throw new Error("Invalid Personal Access Token");
    }

    if (error.response?.status === 429) {
      throw new Error("Calendly API rate limit exceeded. Please try again later.");
    }

    throw new Error(
      error.response?.data?.message ||
        "Failed to validate token with Calendly API"
    );
  }
};

/**
 * Fetch user info from Calendly
 * @param {string} accessToken - Personal Access Token
 * @returns {Promise<Object>} User info
 */
export const fetchUserInfo = async (accessToken) => {
  console.log("[CALENDLY-SERVICE] Fetching user info...");

  try {
    const client = createCalendlyClient(accessToken);
    const response = await retryWithBackoff(() => client.get("/users/me"));

    return response.data.resource;
  } catch (error) {
    console.error("[CALENDLY-SERVICE] Fetch user info failed:", error.message);
    throw error;
  }
};

/**
 * Fetch event types from Calendly
 * @param {string} accessToken - Personal Access Token
 * @param {string} organizationUri - Organization URI
 * @returns {Promise<Array>} Array of event types
 */
export const fetchEventTypes = async (accessToken, organizationUri) => {
  console.log("[CALENDLY-SERVICE] Fetching event types...");

  try {
    const client = createCalendlyClient(accessToken);

    const response = await retryWithBackoff(() =>
      client.get("/event_types", {
        params: {
          organization: organizationUri,
          active: true, // Only fetch active event types
          count: 100, // Max per page
        },
      })
    );

    const eventTypes = response.data.collection || [];

    console.log(
      `[CALENDLY-SERVICE] Fetched ${eventTypes.length} event types`
    );

    // Transform to our schema format
    return eventTypes.map((et) => ({
      uri: et.uri,
      name: et.name,
      slug: et.slug,
      active: et.active,
      duration: et.duration, // Duration in minutes
      schedulingUrl: et.scheduling_url,
    }));
  } catch (error) {
    console.error("[CALENDLY-SERVICE] Fetch event types failed:", error.message);

    if (error.response?.status === 401) {
      throw new Error("Invalid or expired token");
    }

    throw error;
  }
};

/**
 * Fetch available time slots for an event type
 * NOTE: Calendly API has a 7-day maximum range per request
 * This function handles longer ranges by making multiple requests
 *
 * @param {string} accessToken - Personal Access Token
 * @param {string} eventTypeUri - Event type URI
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of available slots
 */
export const fetchAvailableSlots = async (
  accessToken,
  eventTypeUri,
  startDate,
  endDate
) => {
  console.log(
    `[CALENDLY-SERVICE] Fetching slots for ${eventTypeUri} from ${startDate} to ${endDate}`
  );

  try {
    const client = createCalendlyClient(accessToken);

    // Calculate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    console.log(`[CALENDLY-SERVICE] Total days to fetch: ${totalDays}`);

    // Calendly API limit: 7 days per request
    const MAX_DAYS_PER_REQUEST = 7;
    const allSlots = [];

    // Split into 7-day windows
    let currentStart = new Date(start);
    while (currentStart < end) {
      // Calculate window end (max 7 days from currentStart, or endDate, whichever is earlier)
      const windowEnd = new Date(currentStart);
      windowEnd.setDate(windowEnd.getDate() + MAX_DAYS_PER_REQUEST);
      const actualWindowEnd = windowEnd > end ? end : windowEnd;

      // Format as ISO 8601 strings
      const startTime = currentStart.toISOString();
      const endTime = actualWindowEnd.toISOString();

      console.log(
        `[CALENDLY-SERVICE] Fetching window: ${startTime} to ${endTime}`
      );

      try {
        const response = await retryWithBackoff(() =>
          client.get("/event_type_available_times", {
            params: {
              event_type: eventTypeUri,
              start_time: startTime,
              end_time: endTime,
            },
          })
        );

        const windowSlots = response.data.collection || [];
        allSlots.push(...windowSlots);

        console.log(
          `[CALENDLY-SERVICE] Fetched ${windowSlots.length} slots for this window`
        );
      } catch (windowError) {
        console.error(
          `[CALENDLY-SERVICE] Window fetch failed: ${windowError.message}`
        );
        // Continue with next window even if one fails
      }

      // Move to next window
      currentStart = new Date(actualWindowEnd);
      currentStart.setDate(currentStart.getDate() + 1); // Start next window from next day
    }

    console.log(
      `[CALENDLY-SERVICE] Total slots fetched: ${allSlots.length} across ${Math.ceil(totalDays / MAX_DAYS_PER_REQUEST)} requests`
    );

    // Transform to simplified format and remove duplicates
    const uniqueSlots = [];
    const seenSlots = new Set();

    for (const slot of allSlots) {
      const slotKey = `${slot.start_time}-${slot.end_time}`;
      if (!seenSlots.has(slotKey)) {
        seenSlots.add(slotKey);
        uniqueSlots.push({
          start: slot.start_time,
          end: slot.end_time,
          status: slot.status || "available",
        });
      }
    }

    return uniqueSlots;
  } catch (error) {
    console.error(
      "[CALENDLY-SERVICE] Fetch available slots failed:",
      error.message
    );

    if (error.response?.status === 401) {
      throw new Error("Invalid or expired token");
    }

    if (error.response?.status === 404) {
      throw new Error("Event type not found");
    }

    if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded");
    }

    throw error;
  }
};


/**
 * Health check - verify token is still valid
 * @param {string} accessToken - Personal Access Token
 * @returns {Promise<boolean>} True if valid
 */
export const healthCheck = async (accessToken) => {
  try {
    await validateToken(accessToken);
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  validateToken,
  fetchUserInfo,
  fetchEventTypes,
  fetchAvailableSlots,
  healthCheck,
};
