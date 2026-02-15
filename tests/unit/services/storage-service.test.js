// @ts-check

const StorageService = require('../../../src/services/storage-service');
const { STORAGE_KEYS, DEFAULT_PLAN } = require('../../../src/lib/constants');

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
  });

  describe('getReminders', () => {
    it('returns reminders from storage', async () => {
      const mockReminders = [
        { id: '1', chatId: '123@c.us', status: 'pending' },
      ];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.REMINDERS]: mockReminders,
      });

      const result = await StorageService.getReminders();
      expect(result).toEqual(mockReminders);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(STORAGE_KEYS.REMINDERS);
    });

    it('returns empty array when no reminders exist', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await StorageService.getReminders();
      expect(result).toEqual([]);
    });
  });

  describe('saveReminders', () => {
    it('saves reminders to storage', async () => {
      const reminders = [{ id: '1', status: 'pending' }];
      chrome.storage.local.set.mockResolvedValue(undefined);

      await StorageService.saveReminders(reminders);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.REMINDERS]: reminders,
      });
    });
  });

  describe('getUserPlan', () => {
    it('returns user plan from storage', async () => {
      const mockPlan = { planType: 'free', activeReminderLimit: 5 };
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.USER_PLAN]: mockPlan,
      });

      const result = await StorageService.getUserPlan();
      expect(result).toEqual(mockPlan);
    });

    it('returns default plan when not set', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await StorageService.getUserPlan();
      expect(result).toEqual(DEFAULT_PLAN);
    });
  });

  describe('saveUserPlan', () => {
    it('saves user plan to storage', async () => {
      const plan = { planType: 'paid', activeReminderLimit: -1 };
      chrome.storage.local.set.mockResolvedValue(undefined);

      await StorageService.saveUserPlan(plan);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.USER_PLAN]: plan,
      });
    });
  });

  describe('onRemindersChanged', () => {
    it('registers a storage change listener and calls callback on reminders change', () => {
      const callback = jest.fn();
      StorageService.onRemindersChanged(callback);

      // Simulate a storage change using jest-chrome's event system
      const changes = {
        [STORAGE_KEYS.REMINDERS]: {
          newValue: [{ id: '1', status: 'pending' }],
          oldValue: [],
        },
      };
      chrome.storage.onChanged.callListeners(changes, 'local');

      expect(callback).toHaveBeenCalledWith([{ id: '1', status: 'pending' }]);
    });

    it('does not call callback for non-reminder changes', () => {
      const callback = jest.fn();
      StorageService.onRemindersChanged(callback);

      chrome.storage.onChanged.callListeners(
        { someOtherKey: { newValue: 'test' } },
        'local'
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it('does not call callback for sync storage changes', () => {
      const callback = jest.fn();
      StorageService.onRemindersChanged(callback);

      const changes = {
        [STORAGE_KEYS.REMINDERS]: { newValue: [], oldValue: [] },
      };
      chrome.storage.onChanged.callListeners(changes, 'sync');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
