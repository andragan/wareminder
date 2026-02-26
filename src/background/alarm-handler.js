// @ts-check

/**
 * Chrome Alarms API handler for scheduled reminder notifications.
 * Listens for alarm events and triggers corresponding notifications.
 * @module alarm-handler
 */

import { ALARM_PREFIX } from "../lib/constants.js";
import * as StorageService from "../services/storage-service.js";
import { createReminderNotification } from "./notification-handler.js";

/**
 * Handles a fired Chrome alarm by looking up the corresponding reminder
 * and creating a desktop notification.
 * @param {chrome.alarms.Alarm} alarm - The fired alarm object
 * @returns {Promise<void>}
 */
export async function handleAlarmFired(alarm) {
    if (!alarm.name.startsWith(ALARM_PREFIX)) {
        return; // Not a reminder alarm
    }

    const reminderId = alarm.name.slice(ALARM_PREFIX.length);
    const reminders = await StorageService.getReminders();
    const reminder = reminders.find((r) => r.id === reminderId);

    if (reminder && reminder.status === "pending") {
        await createReminderNotification(reminder);
    }
}

/**
 * Register the alarm listener.
 */
chrome.alarms.onAlarm.addListener(handleAlarmFired);
