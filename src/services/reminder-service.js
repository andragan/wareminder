// @ts-check

/**
 * Reminder service for CRUD operations on reminders.
 * Orchestrates validation, storage, and alarm management.
 * All writes go through the service worker (single-writer pattern).
 * @module reminder-service
 */

const { REMINDER_STATUS, ALARM_PREFIX, CLEANUP, STORAGE_QUOTA } = typeof require !== 'undefined'
  ? require('../lib/constants')
  : {};

const { validateCreateReminderPayload } = typeof require !== 'undefined'
  ? require('../lib/validators')
  : {};

const { generateId } = typeof require !== 'undefined'
  ? require('../lib/utils')
  : {};

const StorageService = typeof require !== 'undefined'
  ? require('./storage-service')
  : null;

const PlanService = typeof require !== 'undefined'
  ? require('./plan-service')
  : null;

/**
 * Creates a new reminder, validates input, checks plan limits, schedules alarm.
 * @param {{ chatId: string, chatName: string, scheduledTime: number }} payload
 * @param {{ storage?: typeof StorageService, plan?: typeof PlanService }} [deps] - Injectable dependencies
 * @returns {Promise<object>} The created reminder
 * @throws {Error} ValidationError, PlanLimitError, StorageError
 */
async function createReminder(payload, deps) {
  const storage = (deps && deps.storage) || StorageService;
  const plan = (deps && deps.plan) || PlanService;

  // Validate the payload
  const validation = validateCreateReminderPayload(payload);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.name = 'ValidationError';
    throw err;
  }

  // Check plan limits
  const canCreate = await plan.canCreateReminder(storage);
  if (!canCreate) {
    const planStatus = await plan.getPlanStatus(storage);
    const err = new Error(
      `You've reached the limit of ${planStatus.activeReminderLimit} active reminders. Upgrade to create more.`
    );
    err.name = 'PlanLimitError';
    throw err;
  }

  // Check storage quota
  const quotaCheck = await checkStorageQuota({ storage });
  if (quotaCheck.nearQuota) {
    const err = new Error(
      'Storage is almost full. Please delete some old reminders before creating new ones.'
    );
    err.name = 'StorageQuotaError';
    throw err;
  }

  // Create the reminder object
  const reminder = {
    id: generateId(),
    chatId: payload.chatId.trim(),
    chatName: payload.chatName.trim(),
    scheduledTime: payload.scheduledTime,
    createdAt: Date.now(),
    status: REMINDER_STATUS.PENDING,
    completedAt: null,
  };

  // Save to storage
  const reminders = await storage.getReminders();
  reminders.push(reminder);
  await storage.saveReminders(reminders);

  // Schedule alarm
  await chrome.alarms.create(`${ALARM_PREFIX}${reminder.id}`, {
    when: reminder.scheduledTime,
  });

  return reminder;
}

/**
 * Marks a reminder as completed. Sets completedAt, clears alarm.
 * @param {string} reminderId - ID of the reminder to complete
 * @param {{ storage?: typeof StorageService }} [deps]
 * @returns {Promise<object>} The updated reminder
 * @throws {Error} NotFoundError, AlreadyCompletedError
 */
async function completeReminder(reminderId, deps) {
  const storage = (deps && deps.storage) || StorageService;

  const reminders = await storage.getReminders();
  const index = reminders.findIndex((r) => r.id === reminderId);

  if (index === -1) {
    const err = new Error('Reminder not found');
    err.name = 'NotFoundError';
    throw err;
  }

  if (reminders[index].status === REMINDER_STATUS.COMPLETED) {
    const err = new Error('Reminder is already completed');
    err.name = 'AlreadyCompletedError';
    throw err;
  }

  reminders[index].status = REMINDER_STATUS.COMPLETED;
  reminders[index].completedAt = Date.now();

  await storage.saveReminders(reminders);
  await chrome.alarms.clear(`${ALARM_PREFIX}${reminderId}`);

  return reminders[index];
}

/**
 * Permanently deletes a reminder from storage and clears its alarm.
 * @param {string} reminderId - ID of the reminder to delete
 * @param {{ storage?: typeof StorageService }} [deps]
 * @returns {Promise<string>} The deleted reminder's ID
 * @throws {Error} NotFoundError
 */
async function deleteReminder(reminderId, deps) {
  const storage = (deps && deps.storage) || StorageService;

  const reminders = await storage.getReminders();
  const index = reminders.findIndex((r) => r.id === reminderId);

  if (index === -1) {
    const err = new Error('Reminder not found');
    err.name = 'NotFoundError';
    throw err;
  }

  reminders.splice(index, 1);
  await storage.saveReminders(reminders);
  await chrome.alarms.clear(`${ALARM_PREFIX}${reminderId}`);

  return reminderId;
}

/**
 * Returns all reminders sorted by scheduledTime, with plan context.
 * @param {{ storage?: typeof StorageService, plan?: typeof PlanService }} [deps]
 * @returns {Promise<{ reminders: Array<object>, pendingCount: number, planLimit: number, planType: string }>}
 */
async function getAllReminders(deps) {
  const storage = (deps && deps.storage) || StorageService;
  const plan = (deps && deps.plan) || PlanService;

  const [reminders, planStatus] = await Promise.all([
    storage.getReminders(),
    plan.getPlanStatus(storage),
  ]);

  // Sort by scheduledTime ascending (soonest first)
  reminders.sort((a, b) => a.scheduledTime - b.scheduledTime);

  return {
    reminders,
    pendingCount: planStatus.currentPendingCount,
    planLimit: planStatus.activeReminderLimit,
    planType: planStatus.planType,
  };
}

/**
 * Returns pending reminders that are past their scheduled time.
 * @param {{ storage?: typeof StorageService }} [deps]
 * @returns {Promise<Array<object>>}
 */
async function getOverdueReminders(deps) {
  const storage = (deps && deps.storage) || StorageService;

  const reminders = await storage.getReminders();
  const now = Date.now();
  return reminders.filter(
    (r) => r.status === REMINDER_STATUS.PENDING && r.scheduledTime <= now
  );
}

/**
 * Removes completed reminders older than 30 days.
 * @param {{ storage?: typeof StorageService }} [deps]
 * @returns {Promise<number>} Count of removed reminders
 */
async function cleanupExpiredCompleted(deps) {
  const storage = (deps && deps.storage) || StorageService;

  const reminders = await storage.getReminders();
  const now = Date.now();
  const cutoff = now - CLEANUP.COMPLETED_RETENTION_MS;

  const retained = reminders.filter((r) => {
    if (r.status === REMINDER_STATUS.COMPLETED && r.completedAt && r.completedAt < cutoff) {
      return false;
    }
    return true;
  });

  const removedCount = reminders.length - retained.length;
  if (removedCount > 0) {
    await storage.saveReminders(retained);
  }

  return removedCount;
}

/**
 * Checks if storage is near quota and returns a warning flag.
 * @param {{ storage?: typeof StorageService }} [deps]
 * @returns {Promise<{ nearQuota: boolean, usagePercent: number }>}
 */
async function checkStorageQuota(deps) {
  const storage = (deps && deps.storage) || StorageService;

  const reminders = await storage.getReminders();
  const estimatedBytes = JSON.stringify(reminders).length;
  const usagePercent = estimatedBytes / STORAGE_QUOTA.MAX_BYTES;

  return {
    nearQuota: usagePercent >= STORAGE_QUOTA.WARNING_THRESHOLD,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

const ReminderService = {
  createReminder,
  completeReminder,
  deleteReminder,
  getAllReminders,
  getOverdueReminders,
  cleanupExpiredCompleted,
  checkStorageQuota,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReminderService;
}
