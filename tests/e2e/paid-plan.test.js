// @ts-check

/**
 * E2E acceptance tests for paid plan features.
 * Verifies that paid users can create unlimited reminders,
 * that plan limits are correctly enforced, and that upgrade
 * from free to paid unlocks additional capacity.
 */

const ReminderService = require('../../src/services/reminder-service');
const PlanService = require('../../src/services/plan-service');
const { REMINDER_STATUS, PLAN_LIMITS, ALARM_PREFIX } = require('../../src/lib/constants');

describe('E2E: Paid Plan Features', () => {
  let mockStorage;
  let storedReminders;
  let storedPlan;

  beforeEach(() => {
    jest.clearAllMocks();
    storedReminders = [];
    storedPlan = {
      planType: 'free',
      activeReminderLimit: PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT,
    };

    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);
    chrome.alarms.getAll.mockResolvedValue([]);

    mockStorage = {
      getReminders: jest.fn(() => Promise.resolve([...storedReminders])),
      saveReminders: jest.fn((reminders) => {
        storedReminders = [...reminders];
        return Promise.resolve();
      }),
      getUserPlan: jest.fn(() => Promise.resolve({ ...storedPlan })),
      saveUserPlan: jest.fn((plan) => {
        storedPlan = { ...plan };
        return Promise.resolve();
      }),
    };
  });

  /**
   * Helper: creates N reminders using real PlanService validation.
   * @param {number} count
   * @returns {Promise<object[]>} Array of created reminders
   */
  async function createReminders(count) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const reminder = await ReminderService.createReminder(
        {
          chatId: `551199999900${i}@c.us`,
          chatName: `Contact ${i}`,
          scheduledTime: Date.now() + (i + 1) * 3600000,
        },
        { storage: mockStorage, plan: PlanService }
      );
      created.push(reminder);
    }
    return created;
  }

  describe('free plan limit enforcement', () => {
    it('allows up to 5 reminders on free plan', async () => {
      const created = await createReminders(5);

      expect(created).toHaveLength(5);
      expect(storedReminders).toHaveLength(5);
    });

    it('rejects 6th reminder on free plan with PlanLimitError', async () => {
      await createReminders(5);

      await expect(
        ReminderService.createReminder(
          {
            chatId: '5511999999999@c.us',
            chatName: 'One Too Many',
            scheduledTime: Date.now() + 7200000,
          },
          { storage: mockStorage, plan: PlanService }
        )
      ).rejects.toThrow(/limit of 5/);

      expect(storedReminders).toHaveLength(5);
    });

    it('error has PlanLimitError name', async () => {
      await createReminders(5);

      try {
        await ReminderService.createReminder(
          {
            chatId: '5511999999999@c.us',
            chatName: 'Over Limit',
            scheduledTime: Date.now() + 7200000,
          },
          { storage: mockStorage, plan: PlanService }
        );
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect(err.name).toBe('PlanLimitError');
      }
    });
  });

  describe('paid plan unlimited reminders', () => {
    beforeEach(() => {
      storedPlan = {
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      };
    });

    it('allows creating more than 5 reminders on paid plan', async () => {
      const created = await createReminders(10);

      expect(created).toHaveLength(10);
      expect(storedReminders).toHaveLength(10);
      storedReminders.forEach((r) => {
        expect(r.status).toBe(REMINDER_STATUS.PENDING);
      });
    });

    it('allows creating 20+ reminders on paid plan', async () => {
      const created = await createReminders(20);

      expect(created).toHaveLength(20);
      expect(storedReminders).toHaveLength(20);
      expect(chrome.alarms.create).toHaveBeenCalledTimes(20);
    });

    it('each reminder gets its own alarm', async () => {
      const created = await createReminders(8);

      for (const reminder of created) {
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${ALARM_PREFIX}${reminder.id}`,
          { when: reminder.scheduledTime }
        );
      }
    });
  });

  describe('upgrade from free to paid plan', () => {
    it('allows creating beyond free limit after upgrading to paid', async () => {
      // Start on free plan, create 5 reminders (at limit)
      await createReminders(5);
      expect(storedReminders).toHaveLength(5);

      // Verify 6th is blocked on free plan
      await expect(
        ReminderService.createReminder(
          {
            chatId: '5511999999999@c.us',
            chatName: 'Blocked',
            scheduledTime: Date.now() + 99999999,
          },
          { storage: mockStorage, plan: PlanService }
        )
      ).rejects.toThrow(/limit/);

      // Simulate upgrade to paid plan
      storedPlan = {
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      };

      // 6th reminder should now succeed
      const sixthReminder = await ReminderService.createReminder(
        {
          chatId: '5511999999999@c.us',
          chatName: 'After Upgrade',
          scheduledTime: Date.now() + 99999999,
        },
        { storage: mockStorage, plan: PlanService }
      );

      expect(sixthReminder).toBeDefined();
      expect(sixthReminder.chatName).toBe('After Upgrade');
      expect(storedReminders).toHaveLength(6);
    });

    it('continues to allow creation after upgrade without limit', async () => {
      // Create 5 on free then upgrade
      await createReminders(5);

      storedPlan = {
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      };

      // Create 10 more after upgrade (total 15)
      for (let i = 0; i < 10; i++) {
        await ReminderService.createReminder(
          {
            chatId: `551188888800${i}@c.us`,
            chatName: `Paid Contact ${i}`,
            scheduledTime: Date.now() + (i + 6) * 3600000,
          },
          { storage: mockStorage, plan: PlanService }
        );
      }

      expect(storedReminders).toHaveLength(15);
    });
  });

  describe('plan status reporting', () => {
    it('reports free plan status correctly', async () => {
      await createReminders(3);

      const status = await PlanService.getPlanStatus(mockStorage);

      expect(status).toEqual({
        planType: 'free',
        activeReminderLimit: PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT,
        currentPendingCount: 3,
        canCreateReminder: true,
      });
    });

    it('reports free plan at limit correctly', async () => {
      await createReminders(5);

      const status = await PlanService.getPlanStatus(mockStorage);

      expect(status).toEqual({
        planType: 'free',
        activeReminderLimit: PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT,
        currentPendingCount: 5,
        canCreateReminder: false,
      });
    });

    it('reports paid plan status with unlimited correctly', async () => {
      storedPlan = {
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      };

      await createReminders(15);

      const status = await PlanService.getPlanStatus(mockStorage);

      expect(status).toEqual({
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
        currentPendingCount: 15,
        canCreateReminder: true,
      });
    });

    it('getAllReminders returns paid plan metadata', async () => {
      storedPlan = {
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      };

      await createReminders(8);

      const result = await ReminderService.getAllReminders({
        storage: mockStorage,
        plan: PlanService,
      });

      expect(result.planType).toBe('paid');
      expect(result.planLimit).toBe(PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT);
      expect(result.pendingCount).toBe(8);
      expect(result.reminders).toHaveLength(8);
    });
  });

  describe('completed reminders do not count toward limit', () => {
    it('completing a reminder frees up a slot on free plan', async () => {
      // Fill to limit
      const created = await createReminders(5);
      expect(storedReminders).toHaveLength(5);

      // 6th should fail
      await expect(
        ReminderService.createReminder(
          {
            chatId: '5511999999999@c.us',
            chatName: 'Blocked',
            scheduledTime: Date.now() + 99999999,
          },
          { storage: mockStorage, plan: PlanService }
        )
      ).rejects.toThrow(/limit/);

      // Complete one reminder to free up a slot
      await ReminderService.completeReminder(created[0].id, {
        storage: mockStorage,
      });

      // Now 6th should succeed (4 pending + 1 completed)
      const newReminder = await ReminderService.createReminder(
        {
          chatId: '5511999999999@c.us',
          chatName: 'After Completing One',
          scheduledTime: Date.now() + 99999999,
        },
        { storage: mockStorage, plan: PlanService }
      );

      expect(newReminder).toBeDefined();
      expect(newReminder.chatName).toBe('After Completing One');
      expect(storedReminders).toHaveLength(6); // 5 original + 1 new (1 completed, 5 pending)
    });
  });
});
