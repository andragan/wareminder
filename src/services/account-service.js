// @ts-check
/**
 * Account Service
 * Manages user account state, plan type, and reminder limit enforcement
 * @module account-service
 */

import { PLAN_LIMITS, SUBSCRIPTION_PLANS } from '../lib/constants.js';
import * as StorageService from './storage-service.js';

/**
 * Get user's plan type (free or premium)
 * @param {string} userId - User ID
 * @returns {Promise<string>} Plan type: 'free' or 'premium'
 */
export async function getUserPlan(userId) {
  try {
    // In production, this would fetch from backend/cache
    // For now, return from local storage cache
    const status = await StorageService.getSubscriptionStatus();

    return status?.planType || SUBSCRIPTION_PLANS.FREE;
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
    await StorageService.saveSubscriptionStatus({
      planType: subscription.plan_type,
      status: subscription.status,
      trialEndDate: subscription.trial_end_date,
      nextBillingDate: subscription.next_billing_date,
      gracePeriodEndDate: subscription.grace_period_end_date,
      cancellationDate: subscription.cancellation_date,
      lastSyncedAt: new Date().toISOString(),
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
  const status = await StorageService.getSubscriptionStatus();
  return status || {
    planType: SUBSCRIPTION_PLANS.FREE,
    status: 'active',
  };
}

/**
 * Helper: Get auth token from Chrome identity API
 * @param {boolean} [interactive=false] - If true, prompt user for sign-in
 * @returns {Promise<string|null>} Auth token or null
 */
async function getAuthToken(interactive = false) {
  return new Promise((resolve) => {
    // @ts-ignore - Chrome API
    chrome.identity?.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get auth token:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(token || null);
      }
    });
  });
}

/**
 * Helper: Fetch subscription from backend and update local cache
 * @param {string} token - Auth token
 * @returns {Promise<object>} Subscription object
 * @throws {Error} If fetch fails or response is not ok
 */
async function fetchAndCacheSubscription(token) {
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
    const error = new Error(`Subscription fetch failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const subscription = await response.json();

  // Update local cache
  await StorageService.saveSubscriptionStatus({
    planType: subscription.plan_type,
    status: subscription.status,
    trialEndDate: subscription.trial_end_date,
    nextBillingDate: subscription.next_billing_date,
    gracePeriodEndDate: subscription.grace_period_end_date,
    cancellationDate: subscription.cancellation_date,
    lastSyncedAt: new Date().toISOString(),
  });

  return subscription;
}

/**
 * Perform silent subscription refresh without user interaction.
 * Returns structured outcome distinguishing successful refresh, auth failure, and other errors.
 * @returns {Promise<{outcome: 'refreshed'|'auth_required'|'sync_failed', error?: string, subscription?: object}>}
 */
export async function silentRefreshSubscription() {
  try {
    // Get token silently (no user prompt)
    const token = await getAuthToken(false);
    if (!token) {
      // Silent auth failed - user needs to sign in
      return {
        outcome: 'auth_required',
        error: 'Authentication required for subscription verification',
      };
    }

    const subscription = await fetchAndCacheSubscription(token);

    console.info('Subscription silently refreshed from backend', subscription);
    return {
      outcome: 'refreshed',
      subscription,
    };
  } catch (error) {
    if (error.statusCode === 401) {
      // Token invalid or expired
      return {
        outcome: 'auth_required',
        error: 'Authentication token expired',
      };
    }
    console.error('Error during silent subscription refresh:', error);
    return {
      outcome: 'sync_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Perform interactive auth recovery - prompts user to sign in, then refreshes subscription.
 * Returns structured outcome distinguishing successful recovery, auth failure, and other errors.
 * @returns {Promise<{outcome: 'recovered'|'auth_failed'|'sync_failed', error?: string, subscription?: object}>}
 */
export async function interactiveAuthRecovery() {
  try {
    // Get token interactively (will prompt user if needed)
    const token = await getAuthToken(true);
    if (!token) {
      // User cancelled or auth failed
      return {
        outcome: 'auth_failed',
        error: 'User cancelled sign-in or authentication failed',
      };
    }

    const subscription = await fetchAndCacheSubscription(token);

    console.info('Subscription recovered after interactive auth', subscription);
    return {
      outcome: 'recovered',
      subscription,
    };
  } catch (error) {
    console.error('Error during interactive auth recovery:', error);
    return {
      outcome: 'sync_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
