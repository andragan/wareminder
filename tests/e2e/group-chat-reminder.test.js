// @ts-check

/**
 * E2E acceptance tests for group chat reminder scenarios.
 * Verifies that reminders work correctly with group chat JIDs (@g.us),
 * including creation, notification, click-to-navigate, and management.
 */

const ReminderService = require('../../src/services/reminder-service');
const ChatService = require('../../src/services/chat-service');
const { REMINDER_STATUS, ALARM_PREFIX } = require('../../src/lib/constants');
const { buildNavigationUrl } = require('../../src/lib/utils');

describe('E2E: Group Chat Reminder', () => {
  let mockStorage;
  let mockPlan;
  let storedReminders;

  const GROUP_CHAT_ID = '120363123456789@g.us';
  const GROUP_CHAT_NAME = 'Family Group';

  beforeEach(() => {
    jest.clearAllMocks();
    storedReminders = [];

    chrome.alarms.create.mockResolvedValue(undefined);
    chrome.alarms.clear.mockResolvedValue(true);
    chrome.alarms.getAll.mockResolvedValue([]);
    chrome.tabs.query.mockResolvedValue([]);
    chrome.tabs.create.mockResolvedValue({});
    chrome.tabs.update.mockResolvedValue({});
    chrome.windows.update.mockResolvedValue({});

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

  describe('reminder creation with group chat', () => {
    it('creates a reminder for a group chat (@g.us JID)', async () => {
      const scheduledTime = Date.now() + 3600000;
      const payload = {
        chatId: GROUP_CHAT_ID,
        chatName: GROUP_CHAT_NAME,
        scheduledTime,
      };

      const reminder = await ReminderService.createReminder(payload, {
        storage: mockStorage,
        plan: mockPlan,
      });

      expect(reminder).toMatchObject({
        chatId: GROUP_CHAT_ID,
        chatName: GROUP_CHAT_NAME,
        scheduledTime,
        status: REMINDER_STATUS.PENDING,
        completedAt: null,
      });
      expect(reminder.id).toBeDefined();
      expect(reminder.createdAt).toBeDefined();
    });

    it('stores the group chat reminder in storage', async () => {
      const scheduledTime = Date.now() + 3600000;

      await ReminderService.createReminder(
        { chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime },
        { storage: mockStorage, plan: mockPlan }
      );

      expect(storedReminders).toHaveLength(1);
      expect(storedReminders[0].chatId).toBe(GROUP_CHAT_ID);
    });

    it('schedules a Chrome alarm for the group chat reminder', async () => {
      const scheduledTime = Date.now() + 3600000;

      const reminder = await ReminderService.createReminder(
        { chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime },
        { storage: mockStorage, plan: mockPlan }
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        `${ALARM_PREFIX}${reminder.id}`,
        { when: scheduledTime }
      );
    });
  });

  describe('group chat alongside individual chat reminders', () => {
    it('creates reminders for both group and individual chats', async () => {
      const deps = { storage: mockStorage, plan: mockPlan };
      const scheduledTime = Date.now() + 3600000;

      const groupReminder = await ReminderService.createReminder(
        { chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime },
        deps
      );

      mockPlan.getPlanStatus.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
        currentPendingCount: 1,
        canCreateReminder: true,
      });

      const individualReminder = await ReminderService.createReminder(
        {
          chatId: '5511999999999@c.us',
          chatName: 'John Doe',
          scheduledTime: scheduledTime + 3600000,
        },
        deps
      );

      expect(storedReminders).toHaveLength(2);
      expect(storedReminders[0].chatId).toBe(GROUP_CHAT_ID);
      expect(storedReminders[1].chatId).toBe('5511999999999@c.us');

      const result = await ReminderService.getAllReminders(deps);
      expect(result.reminders).toHaveLength(2);
    });
  });

  describe('group chat navigation on notification click', () => {
    it('builds base WhatsApp URL for group chat (no deep-link)', () => {
      const url = buildNavigationUrl(GROUP_CHAT_ID);
      expect(url).toBe('https://web.whatsapp.com');
    });

    it('navigates to WhatsApp Web base URL for group chats (new tab)', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({});

      await ChatService.navigateToChat(GROUP_CHAT_ID);

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://web.whatsapp.com',
      });
    });

    it('reuses existing WhatsApp tab for group chats', async () => {
      const existingTab = { id: 42, windowId: 1 };
      chrome.tabs.query.mockResolvedValue([existingTab]);
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});

      await ChatService.navigateToChat(GROUP_CHAT_ID);

      expect(chrome.tabs.update).toHaveBeenCalledWith(42, {
        active: true,
        url: 'https://web.whatsapp.com',
      });
      expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });
  });

  describe('group chat reminder lifecycle (create → complete → delete)', () => {
    it('full lifecycle: create → complete → alarm cleared', async () => {
      const deps = { storage: mockStorage, plan: mockPlan };
      const scheduledTime = Date.now() + 3600000;

      // Create
      const reminder = await ReminderService.createReminder(
        { chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime },
        deps
      );

      expect(storedReminders).toHaveLength(1);
      expect(storedReminders[0].status).toBe(REMINDER_STATUS.PENDING);

      // Complete
      const completed = await ReminderService.completeReminder(reminder.id, deps);

      expect(completed.status).toBe(REMINDER_STATUS.COMPLETED);
      expect(completed.completedAt).toBeDefined();
      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        `${ALARM_PREFIX}${reminder.id}`
      );
    });

    it('full lifecycle: create → delete → removed from storage', async () => {
      const deps = { storage: mockStorage, plan: mockPlan };
      const scheduledTime = Date.now() + 3600000;

      // Create
      const reminder = await ReminderService.createReminder(
        { chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime },
        deps
      );

      expect(storedReminders).toHaveLength(1);

      // Delete
      const deletedId = await ReminderService.deleteReminder(reminder.id, deps);

      expect(deletedId).toBe(reminder.id);
      expect(storedReminders).toHaveLength(0);
    });
  });

  describe('group chat overdue detection', () => {
    it('detects overdue group chat reminders', async () => {
      const pastTime = Date.now() - 60000; // 1 minute ago
      storedReminders = [
        {
          id: 'group-1',
          chatId: GROUP_CHAT_ID,
          chatName: GROUP_CHAT_NAME,
          scheduledTime: pastTime,
          createdAt: pastTime - 3600000,
          status: REMINDER_STATUS.PENDING,
          completedAt: null,
        },
      ];

      const overdue = await ReminderService.getOverdueReminders({
        storage: mockStorage,
      });

      expect(overdue).toHaveLength(1);
      expect(overdue[0].chatId).toBe(GROUP_CHAT_ID);
    });
  });
});
