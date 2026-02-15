// @ts-check

/**
 * Storage service abstraction for chrome.storage.local.
 * Provides typed access to reminders and user plan data.
 * All storage reads/writes go through this service.
 * @module storage-service
 */

const { STORAGE_KEYS, DEFAULT_PLAN } = typeof require !== 'undefined'
  ? require('../lib/constants')
  : {};

/**
 * Retrieves all reminders from storage.
 * @returns {Promise<Array<import('../lib/constants').Reminder>>} Array of reminders, empty if none exist
 */
async function getReminders() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.REMINDERS);
  return result[STORAGE_KEYS.REMINDERS] || [];
}

/**
 * Overwrites the entire reminders array in storage.
 * Used exclusively by the service worker (single-writer pattern).
 * @param {Array<object>} reminders - Complete array of reminders to persist
 * @returns {Promise<void>}
 */
async function saveReminders(reminders) {
  await chrome.storage.local.set({ [STORAGE_KEYS.REMINDERS]: reminders });
}

/**
 * Retrieves the user's plan from storage.
 * Returns the default free plan if not set.
 * @returns {Promise<{ planType: string, activeReminderLimit: number }>}
 */
async function getUserPlan() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PLAN);
  return result[STORAGE_KEYS.USER_PLAN] || { ...DEFAULT_PLAN };
}

/**
 * Saves the user's plan to storage.
 * @param {{ planType: string, activeReminderLimit: number }} plan
 * @returns {Promise<void>}
 */
async function saveUserPlan(plan) {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_PLAN]: plan });
}

/**
 * Registers a listener for changes to the reminders key in storage.
 * Fires when any context modifies reminders.
 * @param {(reminders: Array<object>) => void} callback - Called with the new reminders array
 * @returns {void}
 */
function onRemindersChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.REMINDERS]) {
      const newReminders = changes[STORAGE_KEYS.REMINDERS].newValue || [];
      callback(newReminders);
    }
  });
}

const StorageService = {
  getReminders,
  saveReminders,
  getUserPlan,
  saveUserPlan,
  onRemindersChanged,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
