// @ts-check
/**
 * Subscription Sync
 * Background job that periodically syncs subscription status from Supabase
 * Runs every 24 hours or on extension startup
 * Detects state changes: renewal, downgrade, cancellation, grace period expiry
 * Notifies user of changes via chrome.notifications
 * @module subscription-sync
 */

import { SUBSCRIPTION_CONSTANTS, MESSAGE_TYPES } from "../lib/constants.js";
import * as accountService from "../services/account-service.js";

const SYNC_INTERVAL_MS =
    SUBSCRIPTION_CONSTANTS.SYNC_INTERVAL_HOURS * 60 * 60 * 1000; // 24 hours
const SYNC_ALARM_NAME = "subscription-sync";

/**
 * Initialize subscription sync
 * Called from service worker on extension startup
 */
export async function initialize() {
    console.log("Initializing subscription sync");

    // Perform initial sync
    await performSync();

    // Set up periodic sync alarm
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === SYNC_ALARM_NAME) {
            performSync();
        }
    });

    // Create recurring alarm for sync
    chrome.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SUBSCRIPTION_CONSTANTS.SYNC_INTERVAL_HOURS * 60,
    });
}

/**
 * Perform subscription sync from backend
 * Fetches latest subscription status and updates local cache
 * Detects state changes and notifies user
 */
async function performSync() {
    try {
        console.log("Performing subscription sync");

        // First, try to sync using service worker context
        const userId = await getCurrentUserId();
        console.log("Current user ID for sync:", userId);
        if (!userId) {
            console.info("No user ID available for sync (not authenticated)");
            return;
        }

        // Get current cached subscription
        const oldSubscription = await accountService.getCachedSubscription();

        // Sync from backend
        const syncSuccess =
            await accountService.syncSubscriptionFromBackend(userId);
        if (!syncSuccess) {
            console.warn("Subscription sync failed, will retry on next alarm");
            return;
        }

        // Get updated subscription
        const newSubscription = await accountService.getCachedSubscription();

        // Detect and handle state changes
        detectAndHandleStateChanges(oldSubscription, newSubscription);
    } catch (error) {
        console.error("Error during subscription sync:", error);
    }
}

/**
 * Detect state changes and notify user
 * @param {object} oldSubscription - Previous subscription state
 * @param {object} newSubscription - Current subscription state
 */
function detectAndHandleStateChanges(oldSubscription, newSubscription) {
    // Plan changed: free -> premium or premium -> free
    if (oldSubscription.plan_type !== newSubscription.plan_type) {
        handlePlanChange(oldSubscription.plan_type, newSubscription.plan_type);
    }

    // Subscription status changed
    if (oldSubscription.status !== newSubscription.status) {
        handleStatusChange(newSubscription);
    }

    // Grace period started (payment failed)
    if (
        newSubscription.status === "grace_period" &&
        oldSubscription.status !== "grace_period"
    ) {
        handleGracePeriodStarted(newSubscription);
    }

    // Grace period ended (downgrade)
    if (
        oldSubscription.status === "grace_period" &&
        newSubscription.status !== "grace_period" &&
        newSubscription.plan_type === "free"
    ) {
        handleGracePeriodEnded();
    }

    // Trial ended -> active (first payment)
    if (
        oldSubscription.status === "trial" &&
        newSubscription.status === "active"
    ) {
        handleTrialEnded();
    }

    // Subscription cancelled (downgrade pending)
    if (
        newSubscription.status === "cancelled" &&
        oldSubscription.status !== "cancelled"
    ) {
        handleSubscriptionCancelled(newSubscription);
    }
}

/**
 * Handle plan change (free <-> premium)
 * @param {string} oldPlan - Previous plan type
 * @param {string} newPlan - New plan type
 */
function handlePlanChange(oldPlan, newPlan) {
    console.info(`Plan changed from ${oldPlan} to ${newPlan}`);

    if (newPlan === "premium") {
        // Upgraded to premium
        showNotification(
            "Premium activated!",
            "You can now create unlimited reminders. Enjoy!",
        );
        notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
            plan_type: "premium",
        });
    } else {
        // Downgraded to free
        showNotification(
            "Plan downgraded",
            "Your account is now on the free plan (5 reminder limit)",
        );
        notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
            plan_type: "free",
        });
    }
}

/**
 * Handle status change
 * @param {object} subscription - New subscription
 */
function handleStatusChange(subscription) {
    console.info(`Subscription status: ${subscription.status}`);
}

/**
 * Handle grace period started (payment failed)
 * @param {object} subscription - Subscription with grace period info
 */
function handleGracePeriodStarted(subscription) {
    console.info("Grace period started - payment failed");

    const gracePeriodEndDate = new Date(subscription.grace_period_end_date);
    const formattedDate = formatDate(gracePeriodEndDate);

    showNotification(
        "Payment failed",
        `We'll retry charging your card. Your premium access will end on ${formattedDate} if we can't process payment.`,
        { iconUrl: getErrorIconUrl() },
    );

    notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
        status: "grace_period",
        grace_period_end_date: subscription.grace_period_end_date,
    });
}

/**
 * Handle grace period ended (auto-downgrade to free)
 */
function handleGracePeriodEnded() {
    console.info("Grace period ended - downgraded to free plan");

    showNotification(
        "Subscription expired",
        "Your account has been downgraded to free plan. Update your payment method to reactivate premium.",
    );

    notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
        plan_type: "free",
        status: "active",
    });
}

/**
 * Handle trial ended and converted to paid subscription
 */
function handleTrialEnded() {
    console.info("Trial ended - first payment processed");

    showNotification(
        "Welcome to Premium!",
        "Your trial has ended and first payment has been processed. Thanks for upgrading!",
    );

    notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
        status: "active",
    });
}

/**
 * Handle subscription cancellation (pending downgrade)
 * @param {object} subscription - Cancelled subscription with downgrade date
 */
function handleSubscriptionCancelled(subscription) {
    console.info("Subscription cancelled");

    const currentPeriodEnd = new Date(subscription.current_period_end);
    const formattedDate = formatDate(currentPeriodEnd);

    showNotification(
        "Subscription cancelled",
        `Your premium access will end on ${formattedDate}. You'll return to the free plan then.`,
        { iconUrl: getWarningIconUrl() },
    );

    notifyPopup(MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED, {
        status: "cancelled",
        downgrade_date: subscription.current_period_end,
    });
}

/**
 * Show browser notification to user
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} options - Additional notification options
 */
function showNotification(title, message, options = {}) {
    chrome.notifications.create({
        type: "basic",
        title,
        message,
        iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
        priority: 2,
        ...options,
    });
}

/**
 * Notify popup UI of subscription state change
 * Sends message to popup so it can refresh display
 * @param {string} messageType - Message type constant
 * @param {object} data - State change data
 */
function notifyPopup(messageType, data) {
    // Send message to all tabs (popup will receive it if open)
    // @ts-ignore
    chrome.runtime.sendMessage(
        {
            type: messageType,
            data,
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.debug("Popup not available for notification");
            }
        },
    );
}

/**
 * Get current user ID by decoding the Google auth token JWT.
 * Uses non-interactive getAuthToken — no popup shown.
 * @returns {Promise<string|null>} User ID (JWT sub claim) or null
 */
async function getCurrentUserId() {
    try {
        const token = await new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (tok) => {
                if (chrome.runtime.lastError) {
                    console.debug(
                        "getAuthToken failed:",
                        chrome.runtime.lastError.message,
                    );
                    resolve(null);
                } else {
                    resolve(tok || null);
                }
            });
        });

        if (!token) {
            console.debug("No token available");
            return null;
        }

        const ProfileUserInfo = await new Promise((resolve) => {
            chrome.identity.getProfileUserInfo((info) => {
                resolve(info);
            });
        });

        console.debug("Profile user info:", ProfileUserInfo);

        console.debug("Token received, attempting to decode");
        console.debug(
            "Token value (first 50 chars):",
            typeof token === "string" ? token.substring(0, 50) : typeof token,
        );

        // Handle edge cases: null string, undefined string, etc.
        if (
            token === "null" ||
            token === "undefined" ||
            !token ||
            typeof token !== "string"
        ) {
            console.warn("Token is not a valid string:", typeof token, token);
            return null;
        }

        console.log("jwt token: ", token);

        // JWT is three base64url segments: header.payload.signature
        const parts = token.split(".");
        if (parts.length < 3) {
            console.warn(
                "Token does not have expected JWT format (need 3 parts, got",
                parts.length + ")",
            );
            console.debug(
                "Token parts:",
                parts.map((p, i) => `part${i}=[${p.length} chars]`).join(", "),
            );
            return null;
        }

        // Decode base64url payload (replace URL-safe chars, pad if needed)
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

        let payload;
        try {
            const decoded = atob(padded);
            payload = JSON.parse(decoded);
        } catch (decodeError) {
            console.error("Failed to decode JWT payload:", decodeError.message);
            console.debug("Payload part:", parts[1]);
            console.debug("Base64 string:", base64);
            console.debug("Padded string:", padded);
            console.debug("First 20 chars of base64:", base64.substring(0, 20));
            return null;
        }

        const userId = payload.sub || null;
        if (userId) {
            console.debug("Successfully extracted user ID from token");
        } else {
            console.warn('Token does not contain "sub" claim');
        }
        return userId;
    } catch (error) {
        console.error("Error getting current user ID:", error);
        return null;
    }
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

/**
 * Get error icon URL for notifications
 * @returns {string} Icon URL
 */
function getErrorIconUrl() {
    return chrome.runtime.getURL("icons/icon-error.png");
}

/**
 * Get warning icon URL for notifications
 * @returns {string} Icon URL
 */
function getWarningIconUrl() {
    return chrome.runtime.getURL("icons/icon-warning.png");
}
