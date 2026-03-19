// @ts-check

/**
 * E2E acceptance test: Dashboard management lifecycle.
 * Tests: view → complete → delete → empty state.
 */

const { REMINDER_STATUS, ALARM_PREFIX } = require('../../src/lib/constants');
const ReminderService = require('../../src/services/reminder-service');

describe('E2E: Manage Reminders Dashboard', () => {
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

  it('full lifecycle: view → complete → delete → empty state', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create 2 reminders
    const r1 = await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Alice', scheduledTime: Date.now() + 3600000 },
      deps
    );
    const r2 = await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Bob', scheduledTime: Date.now() + 7200000 },
      deps
    );

    // Step 1: View - verify all reminders present
    let result = await ReminderService.getAllReminders(deps);
    expect(result.reminders).toHaveLength(2);

    // Step 2: Complete first reminder
    const completed = await ReminderService.completeReminder(r1.id, deps);
    expect(completed.status).toBe(REMINDER_STATUS.COMPLETED);

    // Verify one pending, one completed
    result = await ReminderService.getAllReminders(deps);
    const pending = result.reminders.filter((r) => r.status === REMINDER_STATUS.PENDING);
    const done = result.reminders.filter((r) => r.status === REMINDER_STATUS.COMPLETED);
    expect(pending).toHaveLength(1);
    expect(done).toHaveLength(1);

    // Step 3: Delete second reminder
    await ReminderService.deleteReminder(r2.id, deps);

    // Verify only completed one remains
    result = await ReminderService.getAllReminders(deps);
    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].status).toBe(REMINDER_STATUS.COMPLETED);

    // Step 4: Delete the completed one too
    await ReminderService.deleteReminder(r1.id, deps);

    // Step 5: Empty state
    result = await ReminderService.getAllReminders(deps);
    expect(result.reminders).toHaveLength(0);
  });

  it('manages overdue and upcoming reminders in correct sections', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create 3 reminders
    await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Overdue 1', scheduledTime: Date.now() + 1000 },
      deps
    );
    await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Overdue 2', scheduledTime: Date.now() + 1000 },
      deps
    );
    await ReminderService.createReminder(
      { chatId: '5533333333333@c.us', chatName: 'Upcoming', scheduledTime: Date.now() + 7200000 },
      deps
    );

    // Make first two overdue
    storedReminders[0].scheduledTime = Date.now() - 120000;
    storedReminders[1].scheduledTime = Date.now() - 60000;

    const now = Date.now();
    const reminders = await mockStorage.getReminders();
    const sorted = [...reminders].sort((a, b) => a.scheduledTime - b.scheduledTime);
    const overdue = sorted.filter((r) => r.status === 'pending' && r.scheduledTime <= now);
    const upcoming = sorted.filter((r) => r.status === 'pending' && r.scheduledTime > now);

    expect(overdue).toHaveLength(2);
    expect(upcoming).toHaveLength(1);
    expect(overdue[0].chatName).toBe('Overdue 1'); // Earlier overdue first
    expect(upcoming[0].chatName).toBe('Upcoming');
  });

  it('completing all reminders results in empty pending state', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    const r1 = await ReminderService.createReminder(
      { chatId: '5511111111111@c.us', chatName: 'Alice', scheduledTime: Date.now() + 3600000 },
      deps
    );
    const r2 = await ReminderService.createReminder(
      { chatId: '5522222222222@c.us', chatName: 'Bob', scheduledTime: Date.now() + 7200000 },
      deps
    );

    await ReminderService.completeReminder(r1.id, deps);
    await ReminderService.completeReminder(r2.id, deps);

    const result = await ReminderService.getAllReminders(deps);
    const pending = result.reminders.filter((r) => r.status === REMINDER_STATUS.PENDING);
    expect(pending).toHaveLength(0);

    const completed = result.reminders.filter((r) => r.status === REMINDER_STATUS.COMPLETED);
    expect(completed).toHaveLength(2);
  });
});
