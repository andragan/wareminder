// @ts-check

/**
 * Chrome Notifications handler for desktop reminder notifications.
 * Creates notifications and handles notification click events.
 * @module notification-handler
 */

import { ALARM_PREFIX } from '../lib/constants.js';
import * as ChatService from '../services/chat-service.js';
import * as StorageService from '../services/storage-service.js';

/**
 * Creates a desktop notification for a reminder.
 * @param {{ id: string, chatName: string, scheduledTime: number }} reminder - The reminder to notify about
 * @returns {Promise<void>}
 */
export async function createReminderNotification(reminder) {
  await chrome.notifications.create(`${ALARM_PREFIX}${reminder.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: `Follow up: ${reminder.chatName}`,
    message: `Time to follow up with ${reminder.chatName}`,
    priority: 2,
    requireInteraction: true,
  });
}

/**
 * Handles notification click events.
 * Navigates to the WhatsApp Web chat and clears the notification.
 * @param {string} notificationId - The clicked notification's ID
 * @returns {Promise<void>}
 */
async function handleNotificationClick(notificationId) {
  if (!notificationId.startsWith(ALARM_PREFIX)) {
    return;
  }

  const reminderId = notificationId.slice(ALARM_PREFIX.length);
  const reminders = await StorageService.getReminders();
  const reminder = reminders.find((r) => r.id === reminderId);

  if (reminder) {
    try {
      await ChatService.navigateToChat(reminder.chatId);
    } catch (e) {
      // Chat navigation failed — notification stays, user can use popup
      console.warn('Failed to navigate to chat:', e.message);
    }
  }

  chrome.notifications.clear(notificationId);
}

/**
 * Register the notification click listener.
 */
chrome.notifications.onClicked.addListener(handleNotificationClick);
