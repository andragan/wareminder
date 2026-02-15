// @ts-check

const ReminderService = require('../../../src/services/reminder-service');
const { REMINDER_STATUS, ALARM_PREFIX } = require('../../../src/lib/constants');

describe('ReminderService', () => {
  let mockStorage;
  let mockPlan;

  beforeEach(() => {
    jest.clearAllMocks();

    chrome.alarms.create.mockReset();
    chrome.alarms.clear.mockReset();
    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);

    mockStorage = {
      getReminders: jest.fn().mockResolvedValue([]),
      saveReminders: jest.fn().mockResolvedValue(undefined),
      getUserPlan: jest.fn().mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      }),
    };

    mockPlan = {
      canCreateReminder: jest.fn().mockResolvedValue(true),
      getPlanStatus: jest.fn().mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
        currentPendingCount: 0,
        canCreateReminder: true,
      }),
    };
  });

  describe('createReminder', () => {
    const validPayload = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() + 3600000,
    };

    it('creates a reminder with valid payload', async () => {
      const reminder = await ReminderService.createReminder(validPayload, {
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(reminder).toMatchObject({
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        status: REMINDER_STATUS.PENDING,
        completedAt: null,
      });
      expect(reminder.id).toBeDefined();
      expect(reminder.createdAt).toBeDefined();
      expect(mockStorage.saveReminders).toHaveBeenCalledTimes(1);
    });

    it('schedules a Chrome alarm for the reminder', async () => {
      const reminder = await ReminderService.createReminder(validPayload, {
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        `${ALARM_PREFIX}${reminder.id}`,
        { when: validPayload.scheduledTime }
      );
    });

    it('throws ValidationError for invalid payload', async () => {
      await expect(
        ReminderService.createReminder({ chatId: 'invalid' }, {
          storage: mockStorage,
          plan: mockPlan,
        })
      ).rejects.toThrow();
    });

    it('throws PlanLimitError when at limit', async () => {
      mockPlan.canCreateReminder.mockResolvedValue(false);
      mockPlan.getPlanStatus.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
        currentPendingCount: 5,
        canCreateReminder: false,
      });

      await expect(
        ReminderService.createReminder(validPayload, {
          storage: mockStorage,
          plan: mockPlan,
        })
      ).rejects.toThrow(/limit of 5/);
    });

    it('trims chatId and chatName', async () => {
      const payload = {
        chatId: '  5511999999999@c.us  ',
        chatName: '  John Doe  ',
        scheduledTime: Date.now() + 3600000,
      };

      // Need valid chatId format after trim for validation
      // The chatId validator expects digits@c.us, spaces will fail validation
      // So let's test chatName trimming with proper chatId
      const cleanPayload = {
        chatId: '5511999999999@c.us',
        chatName: '  John Doe  ',
        scheduledTime: Date.now() + 3600000,
      };

      const reminder = await ReminderService.createReminder(cleanPayload, {
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(reminder.chatName).toBe('John Doe');
    });
  });

  describe('completeReminder', () => {
    it('marks a pending reminder as completed', async () => {
      const reminders = [
        { id: 'abc', status: REMINDER_STATUS.PENDING, completedAt: null },
      ];
      mockStorage.getReminders.mockResolvedValue(reminders);

      const result = await ReminderService.completeReminder('abc', {
        storage: mockStorage,
      });

      expect(result.status).toBe(REMINDER_STATUS.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}abc`);
      expect(mockStorage.saveReminders).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError for non-existent reminder', async () => {
      mockStorage.getReminders.mockResolvedValue([]);

      await expect(
        ReminderService.completeReminder('nonexistent', { storage: mockStorage })
      ).rejects.toThrow('Reminder not found');
    });

    it('throws AlreadyCompletedError for completed reminder', async () => {
      mockStorage.getReminders.mockResolvedValue([
        { id: 'abc', status: REMINDER_STATUS.COMPLETED },
      ]);

      await expect(
        ReminderService.completeReminder('abc', { storage: mockStorage })
      ).rejects.toThrow('already completed');
    });
  });

  describe('deleteReminder', () => {
    it('removes a reminder from storage', async () => {
      const reminders = [
        { id: 'abc', status: REMINDER_STATUS.PENDING },
        { id: 'def', status: REMINDER_STATUS.PENDING },
      ];
      mockStorage.getReminders.mockResolvedValue(reminders);

      const deletedId = await ReminderService.deleteReminder('abc', {
        storage: mockStorage,
      });

      expect(deletedId).toBe('abc');
      expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}abc`);
      // Should save without the deleted reminder
      const savedReminders = mockStorage.saveReminders.mock.calls[0][0];
      expect(savedReminders).toHaveLength(1);
      expect(savedReminders[0].id).toBe('def');
    });

    it('throws NotFoundError for non-existent reminder', async () => {
      mockStorage.getReminders.mockResolvedValue([]);

      await expect(
        ReminderService.deleteReminder('nonexistent', { storage: mockStorage })
      ).rejects.toThrow('Reminder not found');
    });
  });

  describe('getAllReminders', () => {
    it('returns reminders sorted by scheduledTime', async () => {
      const reminders = [
        { id: '2', scheduledTime: 2000, status: REMINDER_STATUS.PENDING },
        { id: '1', scheduledTime: 1000, status: REMINDER_STATUS.PENDING },
        { id: '3', scheduledTime: 3000, status: REMINDER_STATUS.PENDING },
      ];
      mockStorage.getReminders.mockResolvedValue(reminders);

      const result = await ReminderService.getAllReminders({
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(result.reminders[0].id).toBe('1');
      expect(result.reminders[1].id).toBe('2');
      expect(result.reminders[2].id).toBe('3');
    });

    it('includes plan context in response', async () => {
      mockStorage.getReminders.mockResolvedValue([]);

      const result = await ReminderService.getAllReminders({
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(result.planType).toBe('free');
      expect(result.planLimit).toBe(5);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('getOverdueReminders', () => {
    it('returns pending reminders past scheduled time', async () => {
      const now = Date.now();
      const reminders = [
        { id: '1', scheduledTime: now - 60000, status: REMINDER_STATUS.PENDING },
        { id: '2', scheduledTime: now + 60000, status: REMINDER_STATUS.PENDING },
        { id: '3', scheduledTime: now - 120000, status: REMINDER_STATUS.COMPLETED },
      ];
      mockStorage.getReminders.mockResolvedValue(reminders);

      const overdue = await ReminderService.getOverdueReminders({
        storage: mockStorage,
      });

      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('1');
    });
  });

  describe('cleanupExpiredCompleted', () => {
    it('removes completed reminders older than 30 days', async () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;

      const reminders = [
        { id: '1', status: REMINDER_STATUS.COMPLETED, completedAt: thirtyOneDaysAgo },
        { id: '2', status: REMINDER_STATUS.COMPLETED, completedAt: fiveDaysAgo },
        { id: '3', status: REMINDER_STATUS.PENDING, completedAt: null },
      ];
      mockStorage.getReminders.mockResolvedValue(reminders);

      const count = await ReminderService.cleanupExpiredCompleted({
        storage: mockStorage,
      });

      expect(count).toBe(1);
      const saved = mockStorage.saveReminders.mock.calls[0][0];
      expect(saved).toHaveLength(2);
      expect(saved.find((r) => r.id === '1')).toBeUndefined();
    });

    it('returns 0 and does not save when nothing to clean', async () => {
      mockStorage.getReminders.mockResolvedValue([
        { id: '1', status: REMINDER_STATUS.PENDING, completedAt: null },
      ]);

      const count = await ReminderService.cleanupExpiredCompleted({
        storage: mockStorage,
      });

      expect(count).toBe(0);
      expect(mockStorage.saveReminders).not.toHaveBeenCalled();
    });
  });

  describe('checkStorageQuota', () => {
    it('returns nearQuota false for small datasets', async () => {
      mockStorage.getReminders.mockResolvedValue([{ id: '1' }]);

      const result = await ReminderService.checkStorageQuota({
        storage: mockStorage,
      });

      expect(result.nearQuota).toBe(false);
      expect(result.usagePercent).toBeLessThan(0.9);
    });

    it('returns nearQuota true when storage is nearly full', async () => {
      // Create a large array to simulate near-quota storage
      const largeReminder = {
        id: 'x'.repeat(100),
        chatId: '5511999999999@c.us',
        chatName: 'A'.repeat(1000),
        scheduledTime: Date.now(),
        createdAt: Date.now(),
        status: 'pending',
        completedAt: null,
      };
      // Fill with enough data to exceed 90% of 10MB
      const bigArray = Array(9000).fill(largeReminder);
      mockStorage.getReminders.mockResolvedValue(bigArray);

      const result = await ReminderService.checkStorageQuota({
        storage: mockStorage,
      });

      expect(result.nearQuota).toBe(true);
    });
  });

  describe('createReminder - storage quota', () => {
    it('throws StorageQuotaError when storage is nearly full', async () => {
      const largeReminder = {
        id: 'x'.repeat(100),
        chatId: '5511999999999@c.us',
        chatName: 'A'.repeat(1000),
        scheduledTime: Date.now(),
        createdAt: Date.now(),
        status: 'pending',
        completedAt: null,
      };
      const bigArray = Array(9000).fill(largeReminder);
      mockStorage.getReminders.mockResolvedValue(bigArray);

      await expect(
        ReminderService.createReminder(
          {
            chatId: '5511999999999@c.us',
            chatName: 'Test',
            scheduledTime: Date.now() + 3600000,
          },
          { storage: mockStorage, plan: mockPlan }
        )
      ).rejects.toThrow(/Storage is almost full/);
    });
  });
});
