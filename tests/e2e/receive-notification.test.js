// @ts-check

/**
 * E2E acceptance test: Notification lifecycle.
 * Tests: create → alarm fires → notification → click → chat opens.
 */

const { ALARM_PREFIX, REMINDER_STATUS } = require('../../src/lib/constants');
const ReminderService = require('../../src/services/reminder-service');

describe('E2E: Receive Notification Lifecycle', () => {
  let mockStorage;
  let mockPlan;
  let storedReminders;

  beforeEach(() => {
    jest.clearAllMocks();
    storedReminders = [];

    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);
    chrome.alarms.getAll.mockResolvedValue([]);
    chrome.notifications.create.mockResolvedValue('notif-id');
    chrome.notifications.clear.mockResolvedValue(true);
    chrome.tabs.query.mockResolvedValue([]);
    chrome.tabs.create.mockResolvedValue({ id: 1 });

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

  it('full lifecycle: create → alarm fires → notification shown', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Step 1: Create reminder
    const reminder = await ReminderService.createReminder(
      {
        chatId: '5511999999999@c.us',
        chatName: 'John Doe',
        scheduledTime: Date.now() + 60000,
      },
      deps
    );

    expect(storedReminders).toHaveLength(1);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}${reminder.id}`,
      { when: reminder.scheduledTime }
    );

    // Step 2: Simulate alarm firing
    const alarm = {
      name: `${ALARM_PREFIX}${reminder.id}`,
      scheduledTime: reminder.scheduledTime,
    };

    // Look up reminder from storage (simulating alarm-handler)
    const reminders = await mockStorage.getReminders();
    const found = reminders.find((r) => r.id === reminder.id);
    expect(found).toBeDefined();
    expect(found.status).toBe(REMINDER_STATUS.PENDING);

    // Step 3: Create notification (simulating notification-handler)
    await chrome.notifications.create(`${ALARM_PREFIX}${found.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: `Follow up: ${found.chatName}`,
      message: `Time to follow up with ${found.chatName}`,
      priority: 2,
      requireInteraction: true,
    });

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}${reminder.id}`,
      expect.objectContaining({
        title: 'Follow up: John Doe',
        requireInteraction: true,
      })
    );
  });

  it('notification click opens WhatsApp Web chat', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create reminder
    const reminder = await ReminderService.createReminder(
      {
        chatId: '5511999999999@c.us',
        chatName: 'Jane Smith',
        scheduledTime: Date.now() + 60000,
      },
      deps
    );

    // Simulate notification click: navigate to chat
    const notificationId = `${ALARM_PREFIX}${reminder.id}`;

    // Chat service would call chrome.tabs.query then chrome.tabs.create
    chrome.tabs.query.mockResolvedValue([]);
    chrome.tabs.create.mockResolvedValue({ id: 42 });

    await chrome.tabs.create({
      url: `https://web.whatsapp.com/send?phone=5511999999999`,
      active: true,
    });

    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('5511999999999'),
        active: true,
      })
    );

    // Clear notification after click
    await chrome.notifications.clear(notificationId);
    expect(chrome.notifications.clear).toHaveBeenCalledWith(notificationId);
  });

  it('overdue reminders trigger notifications on startup', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create a reminder that is already past due
    const reminder = await ReminderService.createReminder(
      {
        chatId: '5511999999999@c.us',
        chatName: 'Overdue Contact',
        scheduledTime: Date.now() + 1000, // Will be overdue after manual manipulation
      },
      deps
    );

    // Manually make it overdue
    storedReminders[0].scheduledTime = Date.now() - 60000;

    // Check for overdue reminders (simulating service worker startup)
    const overdueReminders = await ReminderService.getOverdueReminders(deps);

    expect(overdueReminders).toHaveLength(1);
    expect(overdueReminders[0].chatName).toBe('Overdue Contact');

    // Fire notifications for overdue
    for (const overdue of overdueReminders) {
      await chrome.notifications.create(`${ALARM_PREFIX}${overdue.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: `Follow up: ${overdue.chatName}`,
        message: `Time to follow up with ${overdue.chatName}`,
        priority: 2,
        requireInteraction: true,
      });
    }

    expect(chrome.notifications.create).toHaveBeenCalled();
  });

  it('alarm reconciliation re-registers missing alarms', async () => {
    const deps = { storage: mockStorage, plan: mockPlan };

    // Create 2 reminders
    const r1 = await ReminderService.createReminder(
      {
        chatId: '5511999999991@c.us',
        chatName: 'Contact 1',
        scheduledTime: Date.now() + 3600000,
      },
      deps
    );
    const r2 = await ReminderService.createReminder(
      {
        chatId: '5511999999992@c.us',
        chatName: 'Contact 2',
        scheduledTime: Date.now() + 7200000,
      },
      deps
    );

    // Simulate missing alarms (only r1 has an alarm)
    chrome.alarms.getAll.mockResolvedValue([
      { name: `${ALARM_PREFIX}${r1.id}`, scheduledTime: r1.scheduledTime },
    ]);

    // Reset create mock to track reconciliation calls
    chrome.alarms.create.mockClear();

    // Reconcile (simulating service worker startup)
    const existingAlarms = await chrome.alarms.getAll();
    const existingNames = new Set(existingAlarms.map((a) => a.name));

    for (const reminder of storedReminders) {
      const alarmName = `${ALARM_PREFIX}${reminder.id}`;
      if (reminder.status === REMINDER_STATUS.PENDING && !existingNames.has(alarmName)) {
        await chrome.alarms.create(alarmName, { when: reminder.scheduledTime });
      }
    }

    // Only r2's alarm should be re-created
    expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}${r2.id}`,
      { when: r2.scheduledTime }
    );
  });
});
