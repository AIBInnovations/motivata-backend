/**
 * @fileoverview Timezone utility for IST (Indian Standard Time) conversion
 * @module utils/timezone
 */

/**
 * IST offset in milliseconds
 * IST = UTC + 5:30 = UTC + 19800000 milliseconds
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

const hasTimezoneInfo = (value) => {
  return typeof value === 'string' && /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
};

const getISTDateParts = (dateObj) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(dateObj);
  const lookup = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day)
  };
};

/**
 * Normalize input to a Date object.
 * Note: Date objects already represent an absolute time in UTC. Adding offsets
 * here causes double-shifting when clients also apply timezone conversions.
 * Use formatIST for display formatting instead.
 *
 * @param {Date|string|number} date - Date to normalize
 * @returns {Date|null} Normalized Date object
 *
 * @example
 * const utcDate = new Date('2026-01-04T10:00:00.000Z');
 * const normalized = toIST(utcDate);
 */
export const toIST = (date) => {
  if (!date) {
    return null;
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    console.warn('[TIMEZONE] Invalid date provided to toIST:', date);
    return null;
  }

  return dateObj;
};

/**
 * Get current date/time (UTC-based Date object)
 *
 * @returns {Date} Current date/time
 *
 * @example
 * const now = nowIST();
 */
export const nowIST = () => {
  return new Date();
};

/**
 * Convert IST wall-clock input to UTC when timezone info is missing.
 * If the input already has timezone information or is a Date, return it as-is.
 *
 * @param {Date|string|number} istDate - IST date to convert
 * @returns {Date|null} Date object in UTC
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

  if (istDate instanceof Date || hasTimezoneInfo(istDate)) {
    return dateObj;
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
 * @returns {Date|null} Date object at 00:00:00 IST
 */
export const startOfDayIST = (date = new Date()) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return null;
  }

  const { year, month, day } = getISTDateParts(dateObj);
  const utcTime = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;

  return new Date(utcTime);
};

/**
 * Get IST date at end of day (23:59:59)
 *
 * @param {Date|string|number} date - Date to get end of day for
 * @returns {Date|null} Date object at 23:59:59 IST
 */
export const endOfDayIST = (date = new Date()) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return null;
  }

  const { year, month, day } = getISTDateParts(dateObj);
  const utcTime = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;

  return new Date(utcTime);
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