// @ts-check

/**
 * Subscription Portal Service
 * Manages portal interactions: generating portal session links, handling cancellations,
 * and managing subscription re-activation.
 * @module subscription-portal-service
 */

import * as storageService from './storage-service.js';

/**
 * Generates a portal session link for the user to manage their subscription.
 * Calls backend function to create a secure portal session token.
 * @param {string} userId - User ID
 * @returns {Promise<string>} Portal session URL
 */
export async function generatePortalSessionLink(userId) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_PORTAL_SESSION',
        payload: { userId },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success) {
          resolve(response.data.portalUrl);
        } else {
          reject(new Error(response?.error || 'Failed to generate portal session'));
        }
      }
    );
  });
}

/**
 * Handles subscription cancellation status from webhook.
 * Updates local subscription status to "cancelled_pending".
 * Called when Xendit/backend sends subscription.deleted event.
 * @param {object} subscription - Updated subscription object from backend
 * @returns {Promise<void>}
 */
export async function handleCancellation(subscription) {
  try {
    // Validate that subscription is being cancelled
    if (subscription.status !== 'cancelled' && subscription.status !== 'cancelled_pending') {
      throw new Error('Invalid cancellation status');
    }

    // Update local cache
    await storageService.saveSubscriptionStatus({
      planType: subscription.plan_type,
      status: subscription.status,
      nextBillingDate: subscription.next_billing_date || null,
      currentPeriodEnd: subscription.current_period_end || null,
      lastSyncedAt: Date.now(),
    });

    // Notify popup of cancellation
    chrome.runtime.sendMessage(
      {
        type: 'SUBSCRIPTION_CANCELLED',
        payload: {
          currentPeriodEnd: subscription.current_period_end,
        },
      },
      () => {
        // Fire and forget - notification is non-critical
      }
    );
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
    throw error;
  }
}

/**
 * Re-activates a cancelled subscription before the end period date.
 * Calls backend to restore the subscription.
 * @param {string} userId - User ID
 * @returns {Promise<object>} Updated subscription object
 */
export async function reactivateSubscription(userId) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'REACTIVATE_SUBSCRIPTION',
        payload: { userId },
      },
      async (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success) {
          // Update local cache with reactivated subscription
          const subscription = response.data;
          try {
            await storageService.saveSubscriptionStatus({
              planType: subscription.plan_type,
              status: subscription.status,
              nextBillingDate: subscription.next_billing_date,
              trialEndDate: subscription.trial_end_date || null,
              lastSyncedAt: Date.now(),
            });
          } catch (error) {
            console.error('Error updating cache after reactivation:', error);
          }
          resolve(subscription);
        } else {
          reject(new Error(response?.error || 'Failed to reactivate subscription'));
        }
      }
    );
  });
}

/**
 * Gets the current cancellation details if subscription is pending cancellation.
 * @returns {Promise<?object>} Cancellation details (periodEnd, status) or null if not cancelled
 */
export async function getCancellationDetails() {
  try {
    const subscription = await storageService.getSubscriptionStatus();
    if (!subscription || subscription.status !== 'cancelled_pending') {
      return null;
    }

    return {
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
      daysRemaining: calculateDaysRemaining(subscription.currentPeriodEnd),
    };
  } catch (error) {
    console.error('Error getting cancellation details:', error);
    return null;
  }
}

/**
 * Calculates days remaining until subscription ends.
 * @param {string} endDate - ISO date string or timestamp
 * @returns {number} Days remaining (can be negative if passed)
 */
function calculateDaysRemaining(endDate) {
  if (!endDate) return 0;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const diffMs = end - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if subscription is actively cancelled (but still in current period).
 * @returns {Promise<boolean>} True if subscription is cancelled_pending
 */
export async function isSubscriptionCancelled() {
  try {
    const subscription = await storageService.getSubscriptionStatus();
    return subscription?.status === 'cancelled_pending';
  } catch (error) {
    console.error('Error checking cancellation status:', error);
    return false;
  }
}

const SubscriptionPortalService = {
  generatePortalSessionLink,
  handleCancellation,
  reactivateSubscription,
  getCancellationDetails,
  isSubscriptionCancelled,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubscriptionPortalService;
}
