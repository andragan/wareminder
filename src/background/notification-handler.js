// @ts-check

/**
 * Chrome Notifications handler for desktop reminder notifications.
 * Creates notifications and handles notification click events.
 * @module notification-handler
 */

import { ALARM_PREFIX } from "../lib/constants.js";
import { formatDateTime } from "../lib/utils.js";
import * as ChatService from "../services/chat-service.js";
import * as StorageService from "../services/storage-service.js";

/**
 * Creates a desktop notification for a reminder.
 * @param {{ id: string, chatName: string, scheduledTime: number }} reminder - The reminder to notify about
 * @returns {Promise<void>}
 */
export async function createReminderNotification(reminder) {
    await chrome.notifications.create(`${ALARM_PREFIX}${reminder.id}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
        title:
            chrome.i18n.getMessage("notificationTitle", [reminder.chatName]) ||
            `Follow up: ${reminder.chatName}`,
        message:
            chrome.i18n.getMessage("notificationBody", [
                reminder.chatName,
                formatDateTime(reminder.scheduledTime),
            ]) ||
            `Time to follow up with ${reminder.chatName} — ${formatDateTime(reminder.scheduledTime)}`,
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
            // Chat navigation failed — show fallback notification guiding user to popup
            console.warn("Failed to navigate to chat:", e.message);
            await chrome.notifications.create(`fallback-${reminderId}`, {
                type: "basic",
                iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
                title: "Could not open chat",
                message: `Unable to open chat with ${reminder.chatName}. Use the popup dashboard to manage this reminder.`,
                priority: 1,
            });
        }
    }

    chrome.notifications.clear(notificationId);
}

/**
 * Register the notification click listener.
 */
chrome.notifications.onClicked.addListener(handleNotificationClick);
