// @ts-check

/**
 * Shared utility functions for the WAReminder extension.
 * @module utils
 */

const { WHATSAPP_URLS } = typeof require !== 'undefined'
  ? require('./constants')
  : { WHATSAPP_URLS: { SEND_PATTERN: 'https://web.whatsapp.com/send?phone=' } };

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() when available, falls back to manual generation.
 * @returns {string} A UUID v4 string
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a timestamp into a human-readable date/time string.
 * @param {number} timestamp - Epoch ms timestamp
 * @param {object} [options] - Intl.DateTimeFormat options override
 * @returns {string} Formatted date/time string
 */
function formatDateTime(timestamp, options) {
  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const mergedOptions = { ...defaultOptions, ...options };
  return new Intl.DateTimeFormat('en-US', mergedOptions).format(new Date(timestamp));
}

/**
 * Formats a relative time description (e.g., "in 2 hours", "3 days ago").
 * @param {number} timestamp - Epoch ms timestamp
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  const suffix = diff < 0 ? 'ago' : '';
  const prefix = diff >= 0 ? 'in ' : '';

  if (minutes < 1) return diff < 0 ? 'just now' : 'in less than a minute';
  if (minutes < 60) return `${prefix}${minutes} minute${minutes !== 1 ? 's' : ''} ${suffix}`.trim();
  if (hours < 24) return `${prefix}${hours} hour${hours !== 1 ? 's' : ''} ${suffix}`.trim();
  return `${prefix}${days} day${days !== 1 ? 's' : ''} ${suffix}`.trim();
}

/**
 * Builds a WhatsApp Web navigation URL for a given chat ID.
 * For individual chats (@c.us), returns a send?phone= URL.
 * For group chats (@g.us), returns the base WhatsApp Web URL.
 * @param {string} chatId - WhatsApp JID (e.g., "5511999999999@c.us")
 * @returns {string} Navigation URL
 */
function buildNavigationUrl(chatId) {
  if (chatId.endsWith('@c.us')) {
    const phone = chatId.replace('@c.us', '');
    return `${WHATSAPP_URLS.SEND_PATTERN}${phone}`;
  }
  // Group chats can't be deep-linked via URL
  return WHATSAPP_URLS.SEND_PATTERN.replace('/send?phone=', '');
}

/**
 * Creates a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

export {
  generateId,
  formatDateTime,
  formatRelativeTime,
  buildNavigationUrl,
  debounce,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    formatDateTime,
    formatRelativeTime,
    buildNavigationUrl,
    debounce,
  };
}
