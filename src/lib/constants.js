// @ts-check

/**
 * Named constants for the WAReminder extension.
 * All magic numbers and strings are centralized here.
 * @module constants
 */

/** @readonly */
const PLAN_LIMITS = Object.freeze({
    FREE_ACTIVE_REMINDER_LIMIT: 5,
    PAID_ACTIVE_REMINDER_LIMIT: -1, // -1 represents unlimited
});

/** @readonly */
const ALARM_PREFIX = "reminder-";

/** @readonly */
const STORAGE_KEYS = Object.freeze({
    REMINDERS: "reminders",
    USER_PLAN: "userPlan",
    SUBSCRIPTION_STATUS: "subscriptionStatus",
    SCHEMA_VERSION: "schemaVersion",
});

/** @readonly */
const DEFAULT_PLAN = Object.freeze({
    planType: "free",
    activeReminderLimit: PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT,
});

/** @readonly */
const REMINDER_STATUS = Object.freeze({
    PENDING: "pending",
    COMPLETED: "completed",
});

/** @readonly */
const MESSAGE_TYPES = Object.freeze({
    CREATE_REMINDER: "CREATE_REMINDER",
    COMPLETE_REMINDER: "COMPLETE_REMINDER",
    DELETE_REMINDER: "DELETE_REMINDER",
    GET_REMINDERS: "GET_REMINDERS",
    GET_PLAN_STATUS: "GET_PLAN_STATUS",
    CHECK_NOTIFICATION_PERMISSION: "CHECK_NOTIFICATION_PERMISSION",
    SYNC_SUBSCRIPTION: "SYNC_SUBSCRIPTION",
    SUBSCRIPTION_STATUS_CHANGED: "SUBSCRIPTION_STATUS_CHANGED",
    INITIATE_CHECKOUT: "INITIATE_CHECKOUT",
    GET_CANCELLATION_STATUS: "GET_CANCELLATION_STATUS",
    GET_SUBSCRIPTION_DETAILS: "GET_SUBSCRIPTION_DETAILS",
    REDIRECT_TO_CUSTOMER_PORTAL: "REDIRECT_TO_CUSTOMER_PORTAL",
    REACTIVATE_SUBSCRIPTION: "REACTIVATE_SUBSCRIPTION",
});

/** @readonly */
const SUBSCRIPTION_CONSTANTS = Object.freeze({
    TRIAL_DAYS: 14,
    GRACE_PERIOD_DAYS: 3,
    SYNC_INTERVAL_HOURS: 24,
    PAYMENT_RETRY_INTERVAL_HOURS: 24,
});

/** @readonly */
const SUBSCRIPTION_PLANS = Object.freeze({
    FREE: "free",
    PREMIUM: "premium",
});

/** @readonly */
const SUBSCRIPTION_STATUS = Object.freeze({
    ACTIVE: "active",
    CANCELLED: "cancelled",
    GRACE_PERIOD: "grace_period",
    TRIAL: "trial",
});

/** @readonly */
const SUBSCRIPTION_EVENT_TYPES = Object.freeze({
    PAYMENT_SUCCESS: "payment_success",
    PAYMENT_FAILED: "payment_failed",
    TRIAL_ENDED: "trial_ended",
    SUBSCRIPTION_RENEWED: "subscription_renewed",
    SUBSCRIPTION_CANCELLED: "subscription_cancelled",
    DOWNGRADE_INITIATED: "downgrade_initiated",
});

/** @readonly */
const SUPABASE_CONFIG = Object.freeze({
    URL: "https://aykadvxcqhmertfxgpet.supabase.co",
    PUBLISHABLE_KEY: "sb_publishable_LNqotHOS04JvH-9yoz-9-Q_JRcoF7as",
});

/** @readonly */
const DEFAULT_PRESET_TIMES = Object.freeze({
    ONE_HOUR_MS: 60 * 60 * 1000,
    TONIGHT_HOUR: 20, // 8 PM
    TOMORROW_HOUR: 9, // 9 AM
});

/** @readonly */
const CLEANUP = Object.freeze({
    COMPLETED_RETENTION_DAYS: 30,
    COMPLETED_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
});

/** @readonly */
const STORAGE_QUOTA = Object.freeze({
    MAX_BYTES: 10 * 1024 * 1024, // 10MB
    WARNING_THRESHOLD: 0.9, // 90%
});

/** @readonly */
const CSS_SELECTORS = Object.freeze({
    APP: "#app",
    MAIN: "#main",
    MAIN_HEADER: "#main header",
    CHAT_LIST_ITEM_SELECTED: '[aria-selected="true"]',
    DATA_ID: "[data-id]",
    REMINDER_BUTTON: '[data-testid="wa-reminder-btn"]',
    REMINDER_PROMPT: '[data-testid="wa-reminder-prompt"]',
});

/** @readonly */
const WHATSAPP_URLS = Object.freeze({
    BASE: "https://web.whatsapp.com",
    SEND_PATTERN: "https://web.whatsapp.com/send?phone=",
    TAB_QUERY: "https://web.whatsapp.com/*",
});

/** @readonly */
const BADGE_COLOR = "#25D366"; // WhatsApp green

/** @readonly */
const MUTATION_OBSERVER_DEBOUNCE_MS = 100;

/** @readonly */
const SCHEMA_VERSION = 1;

// ES6 exports
export {
    PLAN_LIMITS,
    ALARM_PREFIX,
    STORAGE_KEYS,
    DEFAULT_PLAN,
    REMINDER_STATUS,
    MESSAGE_TYPES,
    DEFAULT_PRESET_TIMES,
    CLEANUP,
    STORAGE_QUOTA,
    CSS_SELECTORS,
    WHATSAPP_URLS,
    BADGE_COLOR,
    MUTATION_OBSERVER_DEBOUNCE_MS,
    SCHEMA_VERSION,
    SUBSCRIPTION_CONSTANTS,
    SUBSCRIPTION_PLANS,
    SUBSCRIPTION_STATUS,
    SUBSCRIPTION_EVENT_TYPES,
    SUPABASE_CONFIG
};

// Export for both module and non-module contexts
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        PLAN_LIMITS,
        ALARM_PREFIX,
        STORAGE_KEYS,
        DEFAULT_PLAN,
        REMINDER_STATUS,
        MESSAGE_TYPES,
        DEFAULT_PRESET_TIMES,
        CLEANUP,
        STORAGE_QUOTA,
        CSS_SELECTORS,
        WHATSAPP_URLS,
        BADGE_COLOR,
        MUTATION_OBSERVER_DEBOUNCE_MS,
        SCHEMA_VERSION,
        SUBSCRIPTION_CONSTANTS,
        SUBSCRIPTION_PLANS,
        SUBSCRIPTION_STATUS,
        SUBSCRIPTION_EVENT_TYPES,
        SUPABASE_CONFIG,
    };
}
