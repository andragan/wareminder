// @ts-check
/**
 * Subscription Service
 * Manages subscription state machine, CRUD operations, grace period logic, and downgrades
 * @module subscription-service
 */

import { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS, SUBSCRIPTION_CONSTANTS } from '../lib/constants.js';

/**
 * Get subscription for user from backend
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Subscription object or null if not found
 */
export async function getSubscription(userId) {
  try {
    const getToken = chrome.identity?.getAuthToken;
    if (!getToken) {
      console.warn('Chrome identity API not available');
      return null;
    }

    const { token } = await new Promise((resolve, reject) => {
      // @ts-ignore
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({ token });
        }
      });
    });

    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/get-subscription-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.info('No subscription found for user');
        return null;
      }
      throw new Error(`Subscription fetch failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
}

/**
 * Create subscription for user (called after successful Stripe payment)
 * @param {string} userId - User ID
 * @param {object} stripeData - Data from Stripe (customer_id, subscription_id, etc.)
 * @returns {Promise<boolean>} True if created successfully
 */
export async function createSubscription(userId, stripeData) {
  try {
    // Verify required fields
    if (!userId || !stripeData?.stripe_customer_id) {
      throw new Error('Missing required fields for subscription creation');
    }

    // Note: In production, this would be called via backend function that verifies the Stripe charge
    // For now, subscription is created by webhook handler when payment succeeds
    console.info(`Subscription creation initiated for user ${userId}`, stripeData);
    return true;
  } catch (error) {
    console.error('Error creating subscription:', error);
    return false;
  }
}

/**
 * Update subscription status
 * Manages state transitions: free→trial→active, active→grace_period, grace_period→free, active→cancelled
 * @param {string} userId - User ID
 * @param {string} newStatus - New subscription status
 * @returns {Promise<boolean>} True if updated successfully
 */
export async function updateSubscriptionStatus(userId, newStatus) {
  // Validate status
  const validStatuses = Object.values(SUBSCRIPTION_STATUS);
  if (!validStatuses.includes(newStatus)) {
    console.error(`Invalid subscription status: ${newStatus}`);
    return false;
  }

  try {
    // In production, this would call a backend function to update status
    // For now, log the update
    console.info(`Subscription status update for user ${userId}: ${newStatus}`);
    return true;
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return false;
  }
}

/**
 * Initiate grace period for user (called when payment fails)
 * Sets grace_period status and calculates grace period end date
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if grace period initiated successfully
 */
export async function handleGracePeriod(userId) {
  try {
    const gracePeriodDays = SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS;
    const gracePeriodEndDate = new Date();
    gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + gracePeriodDays);

    console.info(`Grace period initiated for user ${userId}`, {
      gracePeriodDays,
      gracePeriodEndDate: gracePeriodEndDate.toISOString(),
    });

    // In production, this would be triggered by the Stripe webhook handler
    // Backend would update subscription.status = 'grace_period' and set grace period dates
    return true;
  } catch (error) {
    console.error('Error handling grace period:', error);
    return false;
  }
}

/**
 * Downgrade user from premium to free plan
 * Called when subscription expires, is cancelled, or grace period ends
 * @param {string} userId - User ID
 * @param {string} reason - Reason for downgrade (expired|cancelled|grace_period_ended)
 * @returns {Promise<boolean>} True if downgrade successful
 */
export async function downgradeToFree(userId, reason = 'subscription_expired') {
  try {
    if (!userId) {
      throw new Error('User ID required for downgrade');
    }

    console.info(`Downgrading user ${userId} to free plan`, { reason });

    // In production, this would:
    // 1. Call backend to update user_profiles.plan_type = 'free'
    // 2. Update subscriptions.status = 'downgraded'
    // 3. Clear any grace period dates
    // 4. Log event to subscription_events table
    // For now, just log the action
    return true;
  } catch (error) {
    console.error('Error downgrading user:', error);
    return false;
  }
}

/**
 * Check if user is in grace period
 * @param {object} subscription - Subscription object
 * @returns {boolean} True if currently in grace period
 */
export function isInGracePeriod(subscription) {
  if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.GRACE_PERIOD) {
    return false;
  }

  const now = new Date();
  const gracePeriodEnd = new Date(subscription.grace_period_end_date);
  return now < gracePeriodEnd;
}

/**
 * Get days remaining in grace period
 * @param {object} subscription - Subscription object
 * @returns {number} Days remaining (0 if not in grace period or expired)
 */
export function getGracePeriodDaysRemaining(subscription) {
  if (!isInGracePeriod(subscription)) {
    return 0;
  }

  const now = new Date();
  const gracePeriodEnd = new Date(subscription.grace_period_end_date);
  const daysRemaining = Math.ceil((gracePeriodEnd - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
}

/**
 * Get trial days remaining
 * @param {object} subscription - Subscription object
 * @returns {number} Days remaining (0 if not in trial or expired)
 */
export function getTrialDaysRemaining(subscription) {
  if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.TRIAL) {
    return 0;
  }

  const now = new Date();
  const trialEnd = new Date(subscription.trial_end_date);

  if (now > trialEnd) {
    return 0;
  }

  const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
}
