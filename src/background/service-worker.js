// @ts-check

/**
 * MV3 Service Worker entry point for the WAReminder extension.
 * Handles onInstalled initialization, alarm reconciliation,
 * message routing, badge updates, and auto-cleanup.
 * @module service-worker
 */

import {
    DEFAULT_PLAN,
    ALARM_PREFIX,
    REMINDER_STATUS,
    MESSAGE_TYPES,
    BADGE_COLOR,
} from "../lib/constants.js";
import * as StorageService from "../services/storage-service.js";
import * as ReminderService from "../services/reminder-service.js";
import * as PlanService from "../services/plan-service.js";
import * as PaymentService from "../services/payment-service.js";
import "./alarm-handler.js";
import { createReminderNotification } from "./notification-handler.js";
import { initialize as initSubscriptionSync } from "./subscription-sync.js";

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
        if (
            reminder.status === REMINDER_STATUS.PENDING &&
            !existingNames.has(alarmName)
        ) {
            await chrome.alarms.create(alarmName, {
                when: reminder.scheduledTime,
            });
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
    const allReminders = reminders || (await StorageService.getReminders());
    const pendingCount = allReminders.filter(
        (r) => r.status === REMINDER_STATUS.PENDING,
    ).length;
    await chrome.action.setBadgeText({
        text: pendingCount > 0 ? String(pendingCount) : "",
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
        sendResponse({ success: false, error: "Invalid message format" });
        return false;
    }

    const handler = messageHandlers[message.type];
    if (handler) {
        handler(message, sender)
            .then((result) => sendResponse(result))
            .catch((err) => {
                console.error(`Error handling message of type ${message.type}:`, err);
                // Message types that should expose application errors to user
                const userFacingMessageTypes = new Set([
                    MESSAGE_TYPES.CREATE_REMINDER,
                    MESSAGE_TYPES.COMPLETE_REMINDER,
                    MESSAGE_TYPES.DELETE_REMINDER,
                ]);
                const shouldShowError = userFacingMessageTypes.has(
                    message.type,
                );
                const errorMessage = shouldShowError
                    ? err.message
                    : "Failed to process request. Please try again.";
                sendResponse({
                    success: false,
                    error: errorMessage,
                });
            });
        return true; // Keep channel open for async sendResponse
    }

    sendResponse({
        success: false,
        error: `Unknown message type: ${message.type}`,
    });
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
        const reminder = await ReminderService.completeReminder(
            message.payload.reminderId,
        );
        return { success: true, data: { reminder } };
    },

    [MESSAGE_TYPES.DELETE_REMINDER]: async (message) => {
        const deletedId = await ReminderService.deleteReminder(
            message.payload.reminderId,
        );
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

    [MESSAGE_TYPES.INITIATE_CHECKOUT]: async (message) => {
        const userId = message.payload?.userId;
        console.log("Received INITIATE_CHECKOUT message with userId:", userId);
        if (!userId || userId === "current_user") {
            const subscription = await StorageService.getSubscriptionStatus();
            let resolvedUserId = subscription?.userId;

            if (!resolvedUserId) {
                // No cached userId — prompt user to sign in (interactive auth)
                try {
                    const token = await new Promise((resolve, reject) => {
                        chrome.identity.getAuthToken(
                            { interactive: true },
                            (tok) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve(tok || null);
                                }
                            },
                        );
                    });

                    if (!token || typeof token !== 'string') {
                        console.debug('No valid token or wrong type:', typeof token, token);
                        throw new Error(
                            "Please sign in to your Google account to upgrade",
                        );
                    }

                    console.debug('Auth token received (first 20 chars):', token.substring(0, 20));

                    // Use the token to fetch user info from Google
                    const userinfoResponse = await fetch(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        { headers: { Authorization: `Bearer ${token}` } },
                    );
                    if (!userinfoResponse.ok) {
                        throw new Error("Failed to fetch user info from Google");
                    }
                    const userinfo = await userinfoResponse.json();
                    resolvedUserId = userinfo.sub;

                    if (!resolvedUserId) {
                        throw new Error("Unable to extract user ID from token");
                    }
                } catch (error) {
                    throw new Error(
                        error.message ||
                            "Please sign in to your Google account to upgrade",
                    );
                }
            }

            console.log(
                "Initiating checkout for user ID:",
                resolvedUserId,
            );
            return {
                success: true,
                data: {
                    checkoutUrl: await PaymentService.initiateCheckout(
                        resolvedUserId,
                    ),
                },
            };
        }
        return {
            success: true,
            data: {
                checkoutUrl: await PaymentService.initiateCheckout(userId),
            },
        };
    },

    [MESSAGE_TYPES.GET_CANCELLATION_STATUS]: async () => {
        const subscription = await StorageService.getSubscriptionStatus();
        return {
            success: true,
            data: { isCancelled: subscription?.cancellationDate ? true : false },
        };
    },

    [MESSAGE_TYPES.GET_SUBSCRIPTION_DETAILS]: async () => {
        const subscription = await StorageService.getSubscriptionStatus();
        return {
            success: true,
            data: subscription || {},
        };
    },

    [MESSAGE_TYPES.REDIRECT_TO_CUSTOMER_PORTAL]: async () => {
        const token = await chrome.identity.getAuthToken({ interactive: true });
        if (token) {
            const portalUrl = `${process.env.SUPABASE_URL}/functions/v1/subscription-portal?token=${token}`;
            chrome.tabs.create({ url: portalUrl });
            return { success: true };
        }
        throw new Error("Unable to authenticate for customer portal access");
    },

    [MESSAGE_TYPES.REACTIVATE_SUBSCRIPTION]: async () => {
        const subscription = await StorageService.getSubscriptionStatus();
        if (!subscription?.userId) {
            throw new Error("No subscription found to reactivate");
        }
        // Clear cancellation status
        await StorageService.saveSubscriptionStatus({
            ...subscription,
            cancellationDate: null,
        });
        return { success: true, data: { reactivated: true } };
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

    try {
        await initSubscriptionSync();
    } catch (err) {
        console.error('Subscription sync failed on startup:', err);
    }
})();
