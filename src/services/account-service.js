// @ts-check
/**
 * Account Service
 * Manages user account state, plan type, and reminder limit enforcement
 * @module account-service
 */

import { PLAN_LIMITS, SUBSCRIPTION_PLANS } from '../lib/constants.js';

/**
 * Get user's plan type (free or premium)
 * @param {string} userId - User ID
 * @returns {Promise<string>} Plan type: 'free' or 'premium'
 */
export async function getUserPlan(userId) {
  try {
    // In production, this would fetch from backend/cache
    // For now, return from local storage cache
    const cached = await chrome.storage.local.get(['subscriptionStatus']);
    const status = cached.subscriptionStatus || {};

    return status.plan_type || SUBSCRIPTION_PLANS.FREE;
  } catch (error) {
    console.error('Error getting user plan:', error);
    return SUBSCRIPTION_PLANS.FREE;
  }
}

/**
 * Check if user has premium plan
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user is premium
 */
export async function isPremium(userId) {
  const plan = await getUserPlan(userId);
  return plan === SUBSCRIPTION_PLANS.PREMIUM;
}

/**
 * Get reminder limit for user based on plan type
 * @param {string} userId - User ID
 * @returns {Promise<number>} Reminder limit (-1 for unlimited)
 */
export async function getReminderLimit(userId) {
  const plan = await getUserPlan(userId);

  if (plan === SUBSCRIPTION_PLANS.PREMIUM) {
    return PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT; // -1 (unlimited)
  }

  return PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT; // 5
}

/**
 * Check if user can create another reminder
 * @param {string} userId - User ID
 * @param {number} currentReminderCount - Current number of active reminders
 * @returns {Promise<boolean>} True if user can create another reminder
 */
export async function canCreateReminder(userId, currentReminderCount) {
  const limit = await getReminderLimit(userId);

  // -1 means unlimited (premium users)
  if (limit === -1) {
    return true;
  }

  // Check against limit (free users have limit of 5)
  return currentReminderCount < limit;
}

/**
 * Enforce reminder limit for a user
 * Returns clear error if limit would be exceeded
 * @param {string} userId - User ID
 * @param {number} currentReminderCount - Current number of active reminders
 * @returns {Promise<{allowed: boolean, error?: string, limit: number}>}
 */
export async function enforceReminderLimit(userId, currentReminderCount) {
  const limit = await getReminderLimit(userId);
  const allowed = await canCreateReminder(userId, currentReminderCount);

  if (!allowed) {
    return {
      allowed: false,
      error: `You've reached the limit of ${limit} active reminders. Upgrade to Premium for unlimited reminders.`,
      limit,
    };
  }

  return {
    allowed: true,
    limit,
  };
}

/**
 * Sync subscription state from backend to local cache
 * Called on extension startup and periodically in background
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if sync successful
 */
export async function syncSubscriptionFromBackend(userId) {
  try {
    // Get token for authentication
    const token = await getAuthToken();
    if (!token) {
      console.warn('No auth token available for subscription sync');
      return false;
    }

    // Fetch subscription status from backend
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/get-subscription-status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Subscription sync failed: ${response.status}`);
      return false;
    }

    const subscription = await response.json();

    // Update local cache
    await chrome.storage.local.set({
      subscriptionStatus: {
        plan_type: subscription.plan_type,
        status: subscription.status,
        trial_end_date: subscription.trial_end_date,
        next_billing_date: subscription.next_billing_date,
        grace_period_end_date: subscription.grace_period_end_date,
        cancellation_date: subscription.cancellation_date,
        last_synced_at: new Date().toISOString(),
      },
    });

    console.info('Subscription synced from backend', subscription);
    return true;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return false;
  }
}

/**
 * Get cached subscription status from local storage
 * @returns {Promise<object>} Cached subscription status
 */
export async function getCachedSubscription() {
  const cached = await chrome.storage.local.get(['subscriptionStatus']);
  return cached.subscriptionStatus || {
    plan_type: SUBSCRIPTION_PLANS.FREE,
    status: 'active',
  };
}

/**
 * Helper: Get auth token from Chrome identity API
 * @returns {Promise<string|null>} Auth token or null
 */
async function getAuthToken() {
  return new Promise((resolve) => {
    // @ts-ignore - Chrome API
    chrome.identity?.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get auth token:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(token || null);
      }
    });
  });
}
