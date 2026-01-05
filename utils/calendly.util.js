/**
 * @fileoverview Calendly utility functions for encryption and caching
 * @module utils/calendly
 */

import crypto from "crypto";

/**
 * Get encryption key from environment
 */
const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET || "default-secret-key-change-me";
  // Create 32-byte key from secret using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
};

/**
 * Encrypt token using AES-256-CBC
 * @param {string} token - Plain text token
 * @returns {string} Encrypted token in format: iv:encryptedData
 */
export const encryptToken = (token) => {
  if (!token) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // Initialization vector

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV and encrypted data separated by colon
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("[CALENDLY-UTIL] Encryption error:", error);
    throw new Error("Failed to encrypt token");
  }
};

/**
 * Decrypt token using AES-256-CBC
 * @param {string} encryptedToken - Encrypted token in format: iv:encryptedData
 * @returns {string} Decrypted token
 */
export const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;

  try {
    const key = getEncryptionKey();
    const [ivHex, encryptedData] = encryptedToken.split(":");

    if (!ivHex || !encryptedData) {
      throw new Error("Invalid encrypted token format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[CALENDLY-UTIL] Decryption error:", error);
    throw new Error("Failed to decrypt token");
  }
};

/**
 * In-memory cache for Calendly slots
 * Structure: { key: { data: any, expiresAt: timestamp } }
 */
const cache = new Map();

/**
 * Cache data with expiry
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
export const cacheSlots = (key, data, ttlSeconds) => {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  cache.set(key, { data, expiresAt });
  console.log(`[CALENDLY-CACHE] Cached: ${key} (expires in ${ttlSeconds}s)`);
};

/**
 * Get cached data if not expired
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/missing
 */
export const getCachedSlots = (key) => {
  const cached = cache.get(key);

  if (!cached) {
    console.log(`[CALENDLY-CACHE] Miss: ${key}`);
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    console.log(`[CALENDLY-CACHE] Expired: ${key}`);
    cache.delete(key);
    return null;
  }

  console.log(`[CALENDLY-CACHE] Hit: ${key}`);
  return cached.data;
};

/**
 * Clear specific cache key
 * @param {string} key - Cache key to clear
 */
export const clearCache = (key) => {
  cache.delete(key);
  console.log(`[CALENDLY-CACHE] Cleared: ${key}`);
};

/**
 * Clear all cached data
 */
export const clearAllCache = () => {
  const size = cache.size;
  cache.clear();
  console.log(`[CALENDLY-CACHE] Cleared all cache (${size} entries)`);
};

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export const getCacheStats = () => {
  const now = Date.now();
  let validCount = 0;
  let expiredCount = 0;

  cache.forEach((value) => {
    if (now > value.expiresAt) {
      expiredCount++;
    } else {
      validCount++;
    }
  });

  return {
    totalEntries: cache.size,
    validEntries: validCount,
    expiredEntries: expiredCount,
  };
};

/**
 * Generate cache key for Calendly slots
 * @param {string} eventTypeUri - Event type URI
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {string} Cache key
 */
export const generateSlotsCacheKey = (eventTypeUri, startDate, endDate) => {
  // Extract event type ID from URI for shorter key
  const eventTypeId = eventTypeUri.split("/").pop();
  return `calendly:slots:${eventTypeId}:${startDate}:${endDate}`;
};

export default {
  encryptToken,
  decryptToken,
  cacheSlots,
  getCachedSlots,
  clearCache,
  clearAllCache,
  getCacheStats,
  generateSlotsCacheKey,
};
