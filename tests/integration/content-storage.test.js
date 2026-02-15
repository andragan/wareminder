// @ts-check

/**
 * Integration test: Content script ↔ Storage interaction.
 * Tests the full create reminder flow from content script to storage.
 */

const ReminderService = require('../../src/services/reminder-service');
const { REMINDER_STATUS, ALARM_PREFIX } = require('../../src/lib/constants');

describe('Content Script ↔ Storage Integration', () => {
  let mockStorage;
  let mockPlan;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('creates a reminder end-to-end from content script payload', async () => {
    const payload = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() + 3600000,
    };

    const reminder = await ReminderService.createReminder(payload, {
      storage: mockStorage,
      plan: mockPlan,
    });

    // Verify reminder object structure
    expect(reminder).toMatchObject({
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: payload.scheduledTime,
      status: REMINDER_STATUS.PENDING,
      completedAt: null,
    });
    expect(reminder.id).toBeDefined();
    expect(reminder.createdAt).toBeDefined();

    // Verify storage was called
    expect(mockStorage.saveReminders).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: reminder.id })])
    );

    // Verify alarm was scheduled
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}${reminder.id}`,
      { when: payload.scheduledTime }
    );
  });

  it('rejects creation when plan limit is reached', async () => {
    mockPlan.canCreateReminder.mockResolvedValue(false);
    mockPlan.getPlanStatus.mockResolvedValue({
      planType: 'free',
      activeReminderLimit: 5,
      currentPendingCount: 5,
      canCreateReminder: false,
    });

    const payload = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() + 3600000,
    };

    await expect(
      ReminderService.createReminder(payload, {
        storage: mockStorage,
        plan: mockPlan,
      })
    ).rejects.toThrow(/limit of 5/);

    expect(mockStorage.saveReminders).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('validates future time before saving', async () => {
    const payload = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() - 1000, // Past time
    };

    await expect(
      ReminderService.createReminder(payload, {
        storage: mockStorage,
        plan: mockPlan,
      })
    ).rejects.toThrow(/future/);

    expect(mockStorage.saveReminders).not.toHaveBeenCalled();
  });

  it('supports multiple sequential reminder creations', async () => {
    const savedReminders = [];
    mockStorage.getReminders.mockImplementation(() => Promise.resolve([...savedReminders]));
    mockStorage.saveReminders.mockImplementation((reminders) => {
      savedReminders.length = 0;
      savedReminders.push(...reminders);
      return Promise.resolve();
    });

    const payload1 = {
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() + 3600000,
    };
    const payload2 = {
      chatId: '5522888888888@c.us',
      chatName: 'Jane Smith',
      scheduledTime: Date.now() + 7200000,
    };

    const r1 = await ReminderService.createReminder(payload1, {
      storage: mockStorage,
      plan: mockPlan,
    });
    const r2 = await ReminderService.createReminder(payload2, {
      storage: mockStorage,
      plan: mockPlan,
    });

    expect(savedReminders).toHaveLength(2);
    expect(savedReminders[0].id).toBe(r1.id);
    expect(savedReminders[1].id).toBe(r2.id);
    expect(chrome.alarms.create).toHaveBeenCalledTimes(2);
  });
});
