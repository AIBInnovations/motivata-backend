/**
 * @fileoverview Timezone utility for IST (Indian Standard Time) conversion
 * @module utils/timezone
 */

/**
 * IST offset in milliseconds
 * IST = UTC + 5:30 = UTC + 19800000 milliseconds
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

/**
 * Convert any date to IST
 * Takes a date (UTC or any timezone) and returns IST date
 *
 * @param {Date|string|number} date - Date to convert (can be Date object, ISO string, or timestamp)
 * @returns {Date} Date object adjusted to IST
 *
 * @example
 * // Convert UTC to IST
 * const utcDate = new Date('2026-01-04T10:00:00.000Z');
 * const istDate = toIST(utcDate);
 * // Result: 2026-01-04T15:30:00.000Z (displays as 3:30 PM in IST)
 */
export const toIST = (date) => {
  if (!date) {
    return null;
  }

  // Convert input to Date object
  const dateObj = date instanceof Date ? date : new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn('[TIMEZONE] Invalid date provided to toIST:', date);
    return null;
  }

  // Get UTC timestamp and add IST offset
  const utcTime = dateObj.getTime();
  const istTime = utcTime + IST_OFFSET_MS;

  return new Date(istTime);
};

/**
 * Get current date/time in IST
 *
 * @returns {Date} Current date/time in IST
 *
 * @example
 * const now = nowIST();
 * console.log(now); // Current IST time
 */
export const nowIST = () => {
  return toIST(new Date());
};

/**
 * Convert IST date to UTC
 * Takes an IST date and returns UTC date
 *
 * @param {Date|string|number} istDate - IST date to convert
 * @returns {Date} Date object in UTC
 *
 * @example
 * const istDate = new Date('2026-01-04T15:30:00.000Z');
 * const utcDate = fromIST(istDate);
 */
export const fromIST = (istDate) => {
  if (!istDate) {
    return null;
  }

  const dateObj = istDate instanceof Date ? istDate : new Date(istDate);

  if (isNaN(dateObj.getTime())) {
    console.warn('[TIMEZONE] Invalid date provided to fromIST:', istDate);
    return null;
  }

  const istTime = dateObj.getTime();
  const utcTime = istTime - IST_OFFSET_MS;

  return new Date(utcTime);
};

/**
 * Format date in IST timezone
 *
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in IST
 *
 * @example
 * const date = new Date('2026-01-04T10:00:00.000Z');
 * const formatted = formatIST(date);
 * // Result: "1/4/2026, 3:30:00 PM" (IST)
 */
export const formatIST = (date, options = {}) => {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const defaultOptions = {
    timeZone: 'Asia/Kolkata',
    ...options
  };

  return new Intl.DateTimeFormat('en-IN', defaultOptions).format(dateObj);
};

/**
 * Get IST date at start of day (00:00:00)
 *
 * @param {Date|string|number} date - Date to get start of day for
 * @returns {Date} Date object at 00:00:00 IST
 */
export const startOfDayIST = (date = new Date()) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const istDate = toIST(dateObj);

  istDate.setUTCHours(0, 0, 0, 0);
  return istDate;
};

/**
 * Get IST date at end of day (23:59:59)
 *
 * @param {Date|string|number} date - Date to get end of day for
 * @returns {Date} Date object at 23:59:59 IST
 */
export const endOfDayIST = (date = new Date()) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const istDate = toIST(dateObj);

  istDate.setUTCHours(23, 59, 59, 999);
  return istDate;
};

/**
 * Check if a date is in the past (IST timezone)
 *
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPastIST = (date) => {
  if (!date) {
    return false;
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  const now = nowIST();

  return dateObj < now;
};

/**
 * Check if a date is in the future (IST timezone)
 *
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export const isFutureIST = (date) => {
  if (!date) {
    return false;
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  const now = nowIST();

  return dateObj > now;
};

/**
 * Log date in both UTC and IST for debugging
 *
 * @param {string} label - Label for the log
 * @param {Date|string|number} date - Date to log
 */
export const logDateIST = (label, date) => {
  if (!date) {
    console.log(`[TIMEZONE] ${label}: null/undefined`);
    return;
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  const istDate = toIST(dateObj);

  console.log(`[TIMEZONE] ${label}:`);
  console.log(`  UTC:  ${dateObj.toISOString()}`);
  console.log(`  IST:  ${formatIST(istDate, {
    dateStyle: 'full',
    timeStyle: 'long'
  })}`);
  console.log(`  Raw:  ${dateObj}`);
};

export default {
  toIST,
  nowIST,
  fromIST,
  formatIST,
  startOfDayIST,
  endOfDayIST,
  isPastIST,
  isFutureIST,
  logDateIST,
  IST_OFFSET_MS
};
