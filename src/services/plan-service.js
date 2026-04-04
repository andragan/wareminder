// @ts-check

/**
 * Plan service for enforcing subscription limits.
 * Checks whether the user can create new reminders based on their plan.
 * @module plan-service
 */

import { REMINDER_STATUS, PLAN_LIMITS, SUBSCRIPTION_PLANS } from '../lib/constants.js';
import * as StorageService from './storage-service.js';

/**
 * Checks whether the user can create a new reminder based on their plan limit.
 * @param {typeof StorageService} [storage] - Optional storage service override for testing
 * @returns {Promise<boolean>}
 */
async function canCreateReminder(storage) {
  const svc = storage || StorageService;
  const [reminders, plan] = await Promise.all([
    svc.getReminders(),
    svc.getUserPlan(),
  ]);
  const pendingCount = reminders.filter(
    (r) => r.status === REMINDER_STATUS.PENDING
  ).length;

  // -1 means unlimited (paid plan)
  if (plan.activeReminderLimit === PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT) {
    return true;
  }
  return pendingCount < plan.activeReminderLimit;
}

/**
 * Returns the user's plan status with current counts.
 * Normalized from cached subscriptionStatus (primary) and falls back to userPlan (secondary).
 * @param {typeof StorageService} [storage] - Optional storage service override for testing
 * @returns {Promise<{ planType: string, isPremium: boolean, activeReminderLimit: number, currentPendingCount: number, canCreateReminder: boolean }>}
 */
async function getPlanStatus(storage) {
  const svc = storage || StorageService;
  const [reminders, userPlan, subscriptionStatus] = await Promise.all([
    svc.getReminders(),
    svc.getUserPlan(),
    svc.getSubscriptionStatus(),
  ]);

  const currentPendingCount = reminders.filter(
    (r) => r.status === REMINDER_STATUS.PENDING
  ).length;

  // Normalize premium detection: subscription status is primary source of truth
  const isPremium = subscriptionStatus?.planType === SUBSCRIPTION_PLANS.PREMIUM || userPlan.planType === SUBSCRIPTION_PLANS.PREMIUM;
  const planType = isPremium ? SUBSCRIPTION_PLANS.PREMIUM : SUBSCRIPTION_PLANS.FREE;
  
  // Determine active reminder limit based on premium status
  const activeReminderLimit = isPremium 
    ? PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT 
    : userPlan.activeReminderLimit;

  const canCreate =
    activeReminderLimit === PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT ||
    currentPendingCount < activeReminderLimit;

  return {
    planType,
    isPremium,
    activeReminderLimit,
    currentPendingCount,
    canCreateReminder: canCreate,
  };
}

export {
    canCreateReminder,
    getPlanStatus,
}

const PlanService = {
  canCreateReminder,
  getPlanStatus,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlanService;
}
