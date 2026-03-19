// @ts-check

/**
 * E2E acceptance test for reminder creation lifecycle.
 * Tests: create → verify storage → verify alarm
 */

const ReminderService = require('../../src/services/reminder-service');
const { REMINDER_STATUS, ALARM_PREFIX } = require('../../src/lib/constants');

describe('E2E: Create Reminder Lifecycle', () => {
  let mockStorage;
  let mockPlan;
  let storedReminders;

  beforeEach(() => {
    jest.clearAllMocks();
    storedReminders = [];

    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);
    chrome.alarms.getAll.mockResolvedValue([]);

    mockStorage = {
      getReminders: jest.fn(() => Promise.resolve([...storedReminders])),
      saveReminders: jest.fn((reminders) => {
        storedReminders = [...reminders];
        return Promise.resolve();
      }),
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

  it('full lifecycle: create reminder → stored in storage → alarm registered', async () => {
    const scheduledTime = Date.now() + 3600000;
    const payload = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime,
    };

    // Step 1: Create reminder
    const reminder = await ReminderService.createReminder(payload, {
      storage: mockStorage,
      plan: mockPlan,
    });

    // Step 2: Verify reminder is in storage
    expect(storedReminders).toHaveLength(1);
    expect(storedReminders[0]).toMatchObject({
      id: reminder.id,
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime,
      status: REMINDER_STATUS.PENDING,
      completedAt: null,
    });

    // Step 3: Verify alarm was registered
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}${reminder.id}`,
      { when: scheduledTime }
    );
  });

  it('lifecycle with max free reminders then rejection', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create 5 reminders (free plan limit)
    for (let i = 0; i < 5; i++) {
      mockPlan.canCreateReminder.mockResolvedValue(true);
      mockPlan.getPlanStatus.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
        currentPendingCount: i,
        canCreateReminder: true,
      });

      await ReminderService.createReminder(
        {
          chatId: `551199999990${i}@c.us`,
          chatName: `Contact ${i}`,
          scheduledTime: Date.now() + (i + 1) * 3600000,
        },
        deps
      );
    }

    expect(storedReminders).toHaveLength(5);

    // 6th reminder should fail
    mockPlan.canCreateReminder.mockResolvedValue(false);
    mockPlan.getPlanStatus.mockResolvedValue({
      planType: 'free',
      activeReminderLimit: 5,
      currentPendingCount: 5,
      canCreateReminder: false,
    });

    await expect(
      ReminderService.createReminder(
        {
          chatId: '5511999999999@c.us',
          chatName: 'Too Many',
          scheduledTime: Date.now() + 7200000,
        },
        deps
      )
    ).rejects.toThrow(/limit/);

    // Storage should still have 5 reminders
    expect(storedReminders).toHaveLength(5);
  });

  it('lifecycle: create → complete → verify alarm cleared', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create
    const reminder = await ReminderService.createReminder(
      {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() + 3600000,
      },
      deps
    );

    expect(storedReminders).toHaveLength(1);
    expect(storedReminders[0].status).toBe(REMINDER_STATUS.PENDING);

    // Complete
    const completed = await ReminderService.completeReminder(reminder.id, deps);

    expect(completed.status).toBe(REMINDER_STATUS.COMPLETED);
    expect(completed.completedAt).toBeDefined();
    expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}${reminder.id}`);
  });

  it('lifecycle: create → delete → removed from storage', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create
    const reminder = await ReminderService.createReminder(
      {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() + 3600000,
      },
      deps
    );

    expect(storedReminders).toHaveLength(1);

    // Delete
    const deletedId = await ReminderService.deleteReminder(reminder.id, deps);

    expect(deletedId).toBe(reminder.id);
    expect(storedReminders).toHaveLength(0);
    expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}${reminder.id}`);
  });
});
