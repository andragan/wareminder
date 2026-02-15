// @ts-check

/**
 * MV3 Service Worker entry point for the WAReminder extension.
 * Handles onInstalled initialization, alarm reconciliation,
 * message routing, badge updates, and auto-cleanup.
 * @module service-worker
 */

import { DEFAULT_PLAN, ALARM_PREFIX, REMINDER_STATUS, MESSAGE_TYPES, BADGE_COLOR } from '../lib/constants.js';
import * as StorageService from '../services/storage-service.js';
import * as ReminderService from '../services/reminder-service.js';
import * as PlanService from '../services/plan-service.js';
import './alarm-handler.js';
import { createReminderNotification } from './notification-handler.js';

/**
 * Reconciles Chrome alarms with stored reminders.
 * Re-registers any missing alarms for pending future reminders.
 * @returns {Promise<void>}
 */
async function reconcileAlarms() {
  const reminders = await StorageService.getReminders();
  const existingAlarms = await chrome.alarms.getAll();
  const existingNames = new Set(existingAlarms.map((a) => a.name));

  for (const reminder of reminders) {
    const alarmName = `${ALARM_PREFIX}${reminder.id}`;
    if (reminder.status === REMINDER_STATUS.PENDING && !existingNames.has(alarmName)) {
      await chrome.alarms.create(alarmName, { when: reminder.scheduledTime });
    }
  }
}

/**
 * Checks for overdue reminders and fires notifications for them.
 * @returns {Promise<void>}
 */
async function checkOverdueReminders() {
  const overdueReminders = await ReminderService.getOverdueReminders();
  for (const reminder of overdueReminders) {
    await createReminderNotification(reminder);
  }
}

/**
 * Updates the extension badge with the current pending reminder count.
 * @param {Array<object>} [reminders] - Optional reminders array; fetched if not provided
 * @returns {Promise<void>}
 */
async function updateBadge(reminders) {
  const allReminders = reminders || await StorageService.getReminders();
  const pendingCount = allReminders.filter(
    (r) => r.status === REMINDER_STATUS.PENDING
  ).length;
  await chrome.action.setBadgeText({
    text: pendingCount > 0 ? String(pendingCount) : '',
  });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

// --- Event Listeners ---

/**
 * Handle extension install/update events.
 */
chrome.runtime.onInstalled.addListener(async (_details) => {
  // Initialize default user plan if not set
  const plan = await StorageService.getUserPlan();
  if (!plan || !plan.planType) {
    await StorageService.saveUserPlan({ ...DEFAULT_PLAN });
  }

  // Reconcile alarms from storage
  await reconcileAlarms();

  // Run auto-cleanup of expired completed reminders
  await ReminderService.cleanupExpiredCompleted();

  // Initialize badge
  await updateBadge();
});

/**
 * Handle messages from content script and popup.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    sendResponse({ success: false, error: 'Invalid message format' });
    return false;
  }

  const handler = messageHandlers[message.type];
  if (handler) {
    handler(message, sender)
      .then((result) => sendResponse(result))
      .catch((err) => {
        // Wrap storage/Chrome API errors with user-friendly message
        const isStorageError = !err.name || err.name === 'Error' || err.name === 'StorageError';
        const friendlyMessage = isStorageError && !err.message.includes('Reminder')
          && !err.message.includes('limit') && !err.message.includes('must be')
          && !err.message.includes('Invalid') && !err.message.includes('Missing')
          ? 'Failed to save reminder. Please try again.'
          : err.message || 'An unknown error occurred';
        sendResponse({
          success: false,
          error: friendlyMessage,
        });
      });
    return true; // Keep channel open for async sendResponse
  }

  sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
  return false;
});

/**
 * Message handler map for typed action messages.
 */
const messageHandlers = {
  [MESSAGE_TYPES.CREATE_REMINDER]: async (message) => {
    const reminder = await ReminderService.createReminder(message.payload);
    return { success: true, data: { reminder } };
  },

  [MESSAGE_TYPES.COMPLETE_REMINDER]: async (message) => {
    const reminder = await ReminderService.completeReminder(message.payload.reminderId);
    return { success: true, data: { reminder } };
  },

  [MESSAGE_TYPES.DELETE_REMINDER]: async (message) => {
    const deletedId = await ReminderService.deleteReminder(message.payload.reminderId);
    return { success: true, data: { deletedId } };
  },

  [MESSAGE_TYPES.GET_REMINDERS]: async () => {
    const result = await ReminderService.getAllReminders();
    return { success: true, data: result };
  },

  [MESSAGE_TYPES.GET_PLAN_STATUS]: async () => {
    const status = await PlanService.getPlanStatus();
    return { success: true, data: status };
  },

  [MESSAGE_TYPES.CHECK_NOTIFICATION_PERMISSION]: async () => {
    const level = await chrome.notifications.getPermissionLevel();
    return { success: true, data: { permissionLevel: level } };
  },
};

/**
 * Listen for storage changes to update badge reactively.
 */
StorageService.onRemindersChanged((reminders) => {
  updateBadge(reminders);
});

/**
 * Service worker startup: reconcile alarms, check overdue, update badge.
 */
(async () => {
  await reconcileAlarms();
  await checkOverdueReminders();
  await ReminderService.cleanupExpiredCompleted();
  await updateBadge();
})();
