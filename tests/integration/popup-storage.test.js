// @ts-check

/**
 * Integration test: Popup ↔ Storage interaction.
 * Tests rendering list, completing, and deleting reminders from popup context.
 */

const { REMINDER_STATUS, ALARM_PREFIX } = require('../../src/lib/constants');
const ReminderService = require('../../src/services/reminder-service');

describe('Popup ↔ Storage Integration', () => {
  let mockStorage;
  let mockPlan;
  let storedReminders;

  beforeEach(() => {
    jest.clearAllMocks();
    storedReminders = [];

    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);

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

  it('loads and sorts reminders by scheduledTime (soonest first)', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create reminders out of order
    const r1 = await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Later', scheduledTime: Date.now() + 7200000 },
      deps
    );
    const r2 = await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Sooner', scheduledTime: Date.now() + 3600000 },
      deps
    );

    // Fetch all reminders (as popup would via GET_REMINDERS)
    const result = await ReminderService.getAllReminders(deps);
    const sorted = result.reminders.sort((a, b) => a.scheduledTime - b.scheduledTime);

    expect(sorted[0].chatName).toBe('Sooner');
    expect(sorted[1].chatName).toBe('Later');
  });

  it('distinguishes overdue from upcoming reminders', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    const r1 = await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Overdue', scheduledTime: Date.now() + 1000 },
      deps
    );
    const r2 = await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Upcoming', scheduledTime: Date.now() + 7200000 },
      deps
    );

    // Make r1 overdue
    storedReminders[0].scheduledTime = Date.now() - 60000;

    const now = Date.now();
    const reminders = await mockStorage.getReminders();
    const overdue = reminders.filter((r) => r.status === 'pending' && r.scheduledTime <= now);
    const upcoming = reminders.filter((r) => r.status === 'pending' && r.scheduledTime > now);

    expect(overdue).toHaveLength(1);
    expect(overdue[0].chatName).toBe('Overdue');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].chatName).toBe('Upcoming');
  });

  it('completes a reminder from popup and updates storage', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    const reminder = await ReminderService.createReminder(
      { chatId: '5511999999999@c.us', chatName: 'Test', scheduledTime: Date.now() + 3600000 },
      deps
    );

    expect(storedReminders[0].status).toBe(REMINDER_STATUS.PENDING);

    const completed = await ReminderService.completeReminder(reminder.id, deps);

    expect(completed.status).toBe(REMINDER_STATUS.COMPLETED);
    expect(completed.completedAt).toBeDefined();
    expect(storedReminders[0].status).toBe(REMINDER_STATUS.COMPLETED);
    expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}${reminder.id}`);
  });

  it('deletes a reminder from popup and removes from storage', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    const r1 = await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Keep', scheduledTime: Date.now() + 3600000 },
      deps
    );
    const r2 = await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Delete Me', scheduledTime: Date.now() + 7200000 },
      deps
    );

    expect(storedReminders).toHaveLength(2);

    await ReminderService.deleteReminder(r2.id, deps);

    expect(storedReminders).toHaveLength(1);
    expect(storedReminders[0].chatName).toBe('Keep');
    expect(chrome.alarms.clear).toHaveBeenCalledWith(`${ALARM_PREFIX}${r2.id}`);
  });

  it('shows empty state when no reminders exist', async () => {
    const result = await ReminderService.getAllReminders({ storage: mockStorage, plan: mockPlan });

    expect(result.reminders).toHaveLength(0);
    // Popup would show empty state based on this
  });

  it('handles auto-cleanup of old completed reminders', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    const reminder = await ReminderService.createReminder(
      { chatId: '5511999999999@c.us', chatName: 'Old', scheduledTime: Date.now() + 1000 },
      deps
    );

    // Complete and backdate completion to >30 days ago
    await ReminderService.completeReminder(reminder.id, deps);
    storedReminders[0].completedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;

    const cleanedCount = await ReminderService.cleanupExpiredCompleted(deps);

    expect(cleanedCount).toBe(1);
    expect(storedReminders).toHaveLength(0);
  });
});
