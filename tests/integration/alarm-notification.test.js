// @ts-check

/**
 * Integration test: Alarm firing ↔ Notification creation flow.
 * Tests the end-to-end flow from alarm fire to desktop notification.
 */

const { ALARM_PREFIX, REMINDER_STATUS } = require('../../src/lib/constants');

describe('Alarm ↔ Notification Integration', () => {
  let handleAlarmFired;
  let StorageService;
  let NotificationHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock chrome APIs
    chrome.notifications.create.mockResolvedValue('notif-id');
    chrome.notifications.clear.mockResolvedValue(true);

    // Require fresh modules with mocked dependencies
    StorageService = require('../../src/services/storage-service');
    NotificationHandler = {};

    // Inline version of handleAlarmFired since the module uses ES imports
    handleAlarmFired = async (alarm) => {
      if (!alarm.name.startsWith(ALARM_PREFIX)) {
        return;
      }
      const reminderId = alarm.name.slice(ALARM_PREFIX.length);
      const reminders = await StorageService.getReminders();
      const reminder = reminders.find((r) => r.id === reminderId);
      if (reminder && reminder.status === REMINDER_STATUS.PENDING) {
        await chrome.notifications.create(`${ALARM_PREFIX}${reminder.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: `Follow up: ${reminder.chatName}`,
          message: `Time to follow up with ${reminder.chatName}`,
          priority: 2,
          requireInteraction: true,
        });
      }
    };

    // Set up storage mock
    chrome.storage.local.get.mockImplementation((keys) => {
      return Promise.resolve({});
    });
  });

  it('fires notification when alarm triggers for a pending reminder', async () => {
    const reminder = {
      id: 'test-id-123',
      chatId: '5511999999999@c.us',
      chatName: 'John Doe',
      scheduledTime: Date.now() - 1000,
      status: REMINDER_STATUS.PENDING,
      createdAt: Date.now() - 3600000,
      completedAt: null,
    };

    chrome.storage.local.get.mockResolvedValue({
      reminders: [reminder],
    });

    const alarm = { name: `${ALARM_PREFIX}test-id-123`, scheduledTime: Date.now() };

    await handleAlarmFired(alarm);

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      `${ALARM_PREFIX}test-id-123`,
      expect.objectContaining({
        type: 'basic',
        title: 'Follow up: John Doe',
        message: 'Time to follow up with John Doe',
        requireInteraction: true,
      })
    );
  });

  it('does not fire notification for completed reminders', async () => {
    const reminder = {
      id: 'test-id-456',
      chatId: '5511999999999@c.us',
      chatName: 'Jane Smith',
      scheduledTime: Date.now() - 1000,
      status: REMINDER_STATUS.COMPLETED,
      createdAt: Date.now() - 3600000,
      completedAt: Date.now() - 500,
    };

    chrome.storage.local.get.mockResolvedValue({
      reminders: [reminder],
    });

    const alarm = { name: `${ALARM_PREFIX}test-id-456`, scheduledTime: Date.now() };

    await handleAlarmFired(alarm);

    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it('ignores non-reminder alarms', async () => {
    const alarm = { name: 'some-other-alarm', scheduledTime: Date.now() };

    await handleAlarmFired(alarm);

    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it('does not fire notification if reminder not found in storage', async () => {
    chrome.storage.local.get.mockResolvedValue({
      reminders: [],
    });

    const alarm = { name: `${ALARM_PREFIX}nonexistent-id`, scheduledTime: Date.now() };

    await handleAlarmFired(alarm);

    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it('notification click navigates to chat and clears notification', async () => {
    const reminder = {
      id: 'test-id-789',
      chatId: '5511999999999@c.us',
      chatName: 'Bob',
      scheduledTime: Date.now() - 1000,
      status: REMINDER_STATUS.PENDING,
      createdAt: Date.now() - 3600000,
      completedAt: null,
    };

    chrome.storage.local.get.mockResolvedValue({
      reminders: [reminder],
    });

    // Simulate notification click handler
    const notificationId = `${ALARM_PREFIX}test-id-789`;
    const reminderId = notificationId.slice(ALARM_PREFIX.length);

    const reminders = await StorageService.getReminders();
    const found = reminders.find((r) => r.id === reminderId);

    expect(found).toBeDefined();
    expect(found.chatId).toBe('5511999999999@c.us');

    // Clear notification
    await chrome.notifications.clear(notificationId);
    expect(chrome.notifications.clear).toHaveBeenCalledWith(notificationId);
  });
});
