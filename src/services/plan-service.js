// @ts-check

/**
 * Plan service for enforcing subscription limits.
 * Checks whether the user can create new reminders based on their plan.
 * @module plan-service
 */

import { REMINDER_STATUS, PLAN_LIMITS } from '../lib/constants.js';
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
 * @param {typeof StorageService} [storage] - Optional storage service override for testing
 * @returns {Promise<{ planType: string, activeReminderLimit: number, currentPendingCount: number, canCreateReminder: boolean }>}
 */
async function getPlanStatus(storage) {
  const svc = storage || StorageService;
  const [reminders, plan] = await Promise.all([
    svc.getReminders(),
    svc.getUserPlan(),
  ]);
  const currentPendingCount = reminders.filter(
    (r) => r.status === REMINDER_STATUS.PENDING
  ).length;

  const canCreate =
    plan.activeReminderLimit === PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT ||
    currentPendingCount < plan.activeReminderLimit;

  return {
    planType: plan.planType,
    activeReminderLimit: plan.activeReminderLimit,
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
