// @ts-check

const {
  JID_PATTERN,
  validateFutureTime,
  validateChatId,
  validateRequiredFields,
  validateStatus,
  validateCreateReminderPayload,
} = require('../../../src/lib/validators');

describe('validators', () => {
  describe('JID_PATTERN', () => {
    it('matches individual chat JID', () => {
      expect(JID_PATTERN.test('5511999999999@c.us')).toBe(true);
    });

    it('matches group chat JID', () => {
      expect(JID_PATTERN.test('120363123456789@g.us')).toBe(true);
    });

    it('rejects JID without domain', () => {
      expect(JID_PATTERN.test('5511999999999')).toBe(false);
    });

    it('rejects JID with invalid domain', () => {
      expect(JID_PATTERN.test('5511999999999@s.us')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(JID_PATTERN.test('')).toBe(false);
    });

    it('rejects JID with letters in number part', () => {
      expect(JID_PATTERN.test('abc123@c.us')).toBe(false);
    });
  });

  describe('validateFutureTime', () => {
    it('accepts a future timestamp', () => {
      const future = Date.now() + 60000;
      expect(validateFutureTime(future)).toEqual({ valid: true });
    });

    it('rejects a past timestamp', () => {
      const past = Date.now() - 60000;
      const result = validateFutureTime(past);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('rejects the current timestamp', () => {
      const now = Date.now();
      // Date.now() at validation will be >= now
      const result = validateFutureTime(now);
      expect(result.valid).toBe(false);
    });

    it('rejects NaN', () => {
      const result = validateFutureTime(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('rejects non-number types', () => {
      // @ts-ignore - testing invalid input
      const result = validateFutureTime('not-a-number');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateChatId', () => {
    it('accepts valid individual chat ID', () => {
      expect(validateChatId('5511999999999@c.us')).toEqual({ valid: true });
    });

    it('accepts valid group chat ID', () => {
      expect(validateChatId('120363123456789@g.us')).toEqual({ valid: true });
    });

    it('rejects null', () => {
      const result = validateChatId(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid chat identifier');
    });

    it('rejects empty string', () => {
      const result = validateChatId('');
      expect(result.valid).toBe(false);
    });

    it('rejects malformed JID', () => {
      const result = validateChatId('not-a-jid');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateRequiredFields', () => {
    it('accepts payload with all required fields', () => {
      const payload = {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() + 60000,
      };
      expect(validateRequiredFields(payload)).toEqual({ valid: true });
    });

    it('rejects null payload', () => {
      const result = validateRequiredFields(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('payload');
    });

    it('rejects missing chatId', () => {
      const result = validateRequiredFields({ chatName: 'Test', scheduledTime: 123 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('chatId');
    });

    it('rejects empty chatName', () => {
      const result = validateRequiredFields({
        chatId: '123@c.us',
        chatName: '   ',
        scheduledTime: 123,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('chatName');
    });

    it('rejects missing scheduledTime', () => {
      const result = validateRequiredFields({
        chatId: '123@c.us',
        chatName: 'Test',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('scheduledTime');
    });
  });

  describe('validateStatus', () => {
    it('accepts "pending"', () => {
      expect(validateStatus('pending')).toEqual({ valid: true });
    });

    it('accepts "completed"', () => {
      expect(validateStatus('completed')).toEqual({ valid: true });
    });

    it('rejects invalid status', () => {
      const result = validateStatus('cancelled');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid status');
    });
  });

  describe('validateCreateReminderPayload', () => {
    it('accepts a valid payload', () => {
      const payload = {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() + 3600000,
      };
      expect(validateCreateReminderPayload(payload)).toEqual({ valid: true });
    });

    it('rejects payload with past time', () => {
      const payload = {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() - 1000,
      };
      const result = validateCreateReminderPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('rejects payload with invalid chatId', () => {
      const payload = {
        chatId: 'Invalid-ChatId!',  // Contains uppercase, hyphens, and special chars
        chatName: 'John Doe',
        scheduledTime: Date.now() + 3600000,
      };
      const result = validateCreateReminderPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid chat identifier');
    });

    it('accepts payload with slugified chatId', () => {
      const payload = {
        chatId: 'john_doe_chat',  // Slugified chat name
        chatName: 'John Doe',
        scheduledTime: Date.now() + 3600000,
      };
      const result = validateCreateReminderPayload(payload);
      expect(result.valid).toBe(true);
    });

    it('rejects payload with missing fields', () => {
      const result = validateCreateReminderPayload({});
      expect(result.valid).toBe(false);
    });
  });
});
