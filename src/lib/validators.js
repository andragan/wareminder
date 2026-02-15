// @ts-check

/**
 * Input validators for the WAReminder extension.
 * All validation logic is centralized here.
 * @module validators
 */

import { REMINDER_STATUS } from './constants.js';

/** @type {RegExp} WhatsApp JID format: digits@c.us or digits@g.us */
const JID_PATTERN = /^\d+@(c\.us|g\.us)$/;

/** @type {RegExp} Slugified chat name format: lowercase with underscores */
const SLUG_PATTERN = /^[a-z0-9_]+$/;

/**
 * Validates that a timestamp is strictly in the future.
 * @param {number} scheduledTime - Epoch ms timestamp to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFutureTime(scheduledTime) {
  if (typeof scheduledTime !== 'number' || isNaN(scheduledTime)) {
    return { valid: false, error: 'Scheduled time must be a valid number' };
  }
  if (scheduledTime <= Date.now()) {
    return { valid: false, error: 'Reminder time must be in the future' };
  }
  return { valid: true };
}

/**
 * Validates a chat identifier: either WhatsApp JID (phone@c.us) or slugified name.
 * @param {string} chatId - Chat identifier to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateChatId(chatId) {
  if (!chatId || typeof chatId !== 'string') {
    return { valid: false, error: 'Invalid chat identifier' };
  }
  // Accept either JID format or slugified chat name
  if (!JID_PATTERN.test(chatId) && !SLUG_PATTERN.test(chatId)) {
    return { valid: false, error: 'Invalid chat identifier' };
  }
  return { valid: true };
}

/**
 * Validates that required fields are present and non-empty.
 * @param {{ chatId?: string, chatName?: string, scheduledTime?: number }} payload
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRequiredFields(payload) {
  if (!payload) {
    return { valid: false, error: 'Missing required field: payload' };
  }
  if (!payload.chatId || typeof payload.chatId !== 'string' || !payload.chatId.trim()) {
    return { valid: false, error: 'Missing required field: chatId' };
  }
  if (!payload.chatName || typeof payload.chatName !== 'string' || !payload.chatName.trim()) {
    return { valid: false, error: 'Missing required field: chatName' };
  }
  if (payload.scheduledTime === undefined || payload.scheduledTime === null) {
    return { valid: false, error: 'Missing required field: scheduledTime' };
  }
  return { valid: true };
}

/**
 * Validates that a status value is one of the allowed enum values.
 * @param {string} status - Status value to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateStatus(status) {
  const validStatuses = [REMINDER_STATUS.PENDING, REMINDER_STATUS.COMPLETED];
  if (!validStatuses.includes(status)) {
    return { valid: false, error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Runs all creation validations on a CREATE_REMINDER payload.
 * Returns the first error found, or a success result.
 * @param {{ chatId?: string, chatName?: string, scheduledTime?: number }} payload
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCreateReminderPayload(payload) {
  const requiredCheck = validateRequiredFields(payload);
  if (!requiredCheck.valid) return requiredCheck;

  const chatIdCheck = validateChatId(payload.chatId);
  if (!chatIdCheck.valid) return chatIdCheck;

  const timeCheck = validateFutureTime(payload.scheduledTime);
  if (!timeCheck.valid) return timeCheck;

  return { valid: true };
}

export {
    validateFutureTime,
    validateChatId,
    validateRequiredFields,
    validateStatus,
    validateCreateReminderPayload,
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JID_PATTERN,
    validateFutureTime,
    validateChatId,
    validateRequiredFields,
    validateStatus,
    validateCreateReminderPayload,
  };
}
