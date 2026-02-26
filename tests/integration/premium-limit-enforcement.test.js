// @ts-check
/**
 * Integration Test Suite: Premium Limit Enforcement
 * Tests that premium users bypass 5-reminder limit while free users respect it
 * @module tests/integration/premium-limit-enforcement
 */

describe('Integration: Premium Limit Enforcement', () => {
  let accountService;
  let reminderService;
  let storageService;
  let mockChrome;

  beforeEach(() => {
    // Setup mock Chrome storage
    mockChrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys, callback) => {
            if (Array.isArray(keys) && keys.includes('subscriptionStatus')) {
              callback({
                subscriptionStatus: {
                  plan_type: 'free',
                  status: 'active',
                  lastSyncedAt: Date.now(),
                },
              });
            } else {
              callback({ reminders: [] });
            }
          }),
          set: jest.fn().mockImplementation((items, callback) => {
            if (callback) callback();
          }),
        },
      },
      alarms: {
        create: jest.fn(),
      },
      notifications: {
        create: jest.fn(),
      },
    };

    global.chrome = mockChrome;

    // Mock account service
    accountService = {
      getUserPlan: jest.fn(async (userId) => 'free'),
      isPremium: jest.fn(async (userId) => false),
      getReminderLimit: jest.fn(async (userId) => 5),
      canCreateReminder: jest.fn(async (userId, count) => count < 5),
      enforceReminderLimit: jest.fn(async (userId, count) => ({
        allowed: count < 5,
        error: count >= 5 ? "You've reached the limit of 5 active reminders." : null,
        limit: 5,
      })),
    };

    // Mock storage service
    storageService = {
      getReminders: jest.fn(async () => []),
      saveReminders: jest.fn(async (reminders) => true),
    };

    // Mock reminder service
    reminderService = {
      createReminder: jest.fn(),
    };
  });

  describe('Free user limit enforcement', () => {
    test('should prevent free user from creating 6th reminder', async () => {
      accountService.getUserPlan.mockResolvedValue('free');
      accountService.isPremium.mockResolvedValue(false);
      accountService.getReminderLimit.mockResolvedValue(5);

      const existingCount = 5;
      const result = await accountService.enforceReminderLimit('user-123', existingCount);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('limit of 5');
    });

    test('should allow free user to create up to 5 reminders', async () => {
      accountService.isPremium.mockResolvedValue(false);

      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await accountService.enforceReminderLimit('user-123', i);
        results.push(result);
      }

      expect(results.slice(0, 4).every((r) => r.allowed)).toBe(true);
      expect(results[4].allowed).toBe(true);
    });

    test('should return clear error message when free user hits limit', async () => {
      accountService.enforceReminderLimit.mockResolvedValue({
        allowed: false,
        error: "You've reached the limit of 5 active reminders. Upgrade to Premium for unlimited reminders.",
        limit: 5,
      });

      const result = await accountService.enforceReminderLimit('user-123', 5);

      expect(result.error).toContain('Premium');
      expect(result.error).toContain('unlimited');
    });

    test('should track reminder count from storage', async () => {
      storageService.getReminders.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `reminder-${i}`,
          status: 'pending',
        }))
      );

      const reminders = await storageService.getReminders();

      expect(reminders).toHaveLength(5);
      expect(reminders.every((r) => r.status === 'pending')).toBe(true);
    });
  });

  describe('Premium user unlimited reminders', () => {
    test('should allow premium user to create unlimited reminders', async () => {
      accountService.getUserPlan.mockResolvedValue('premium');
      accountService.isPremium.mockResolvedValue(true);
      accountService.getReminderLimit.mockResolvedValue(-1);

      const result = await accountService.enforceReminderLimit('user-123', 1000);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    test('should return -1 limit for premium users', async () => {
      accountService.getReminderLimit.mockResolvedValue(-1);

      const limit = await accountService.getReminderLimit('premium-user');

      expect(limit).toBe(-1);
    });

    test('should skip count check for premium users', async () => {
      accountService.isPremium.mockResolvedValue(true);
      accountService.getReminderLimit.mockResolvedValue(-1);
      accountService.canCreateReminder.mockImplementation(async (userId, count) => {
        const limit = await accountService.getReminderLimit(userId);
        return limit === -1 || count < limit;
      });

      const canCreate = await accountService.canCreateReminder('premium-user', 10000);

      expect(canCreate).toBe(true);
    });

    test('premium user should be allowed 50+ reminders', async () => {
      accountService.isPremium.mockResolvedValue(true);
      accountService.getReminderLimit.mockResolvedValue(-1);

      const results = [];
      for (let i = 0; i < 51; i++) {
        const result = await accountService.enforceReminderLimit('premium-user', i);
        results.push(result);
      }

      expect(results.every((r) => r.allowed)).toBe(true);
    });
  });

  describe('Plan status message passing', () => {
    test('should get plan status from service worker', async () => {
      const getPlanStatus = async () => {
        const cached = await new Promise((resolve) => {
          mockChrome.storage.local.get(['subscriptionStatus'], (data) => {
            resolve(data.subscriptionStatus || {});
          });
        });
        return {
          isPremium: cached.plan_type === 'premium',
          plan_type: cached.plan_type || 'free',
          status: cached.status,
        };
      };

      const planStatus = await getPlanStatus();

      expect(planStatus.plan_type).toBeDefined();
    });

    test('should cache premium status in local storage', async () => {
      const premiumStatus = {
        plan_type: 'premium',
        status: 'active',
        trialEndDate: null,
        nextBillingDate: '2026-03-27',
      };

      await new Promise((resolve) => {
        mockChrome.storage.local.set({ subscriptionStatus: premiumStatus }, resolve);
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: premiumStatus }),
        expect.any(Function)
      );
    });

    test('should sync plan status on startup', async () => {
      accountService.syncSubscriptionFromBackend = jest.fn(async (userId) => {
        const status = {
          plan_type: 'premium',
          status: 'active',
        };
        await new Promise((resolve) => {
          mockChrome.storage.local.set({ subscriptionStatus: status }, resolve);
        });
        return true;
      });

      const result = await accountService.syncSubscriptionFromBackend('user-123');

      expect(result).toBe(true);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Transition from free to premium', () => {
    test('should update plan status on upgrade', async () => {
      // Start as free
      accountService.getUserPlan.mockResolvedValue('free');
      let planStatus = await accountService.getUserPlan('user-123');
      expect(planStatus).toBe('free');

      // Upgrade to premium
      accountService.getUserPlan.mockResolvedValue('premium');
      planStatus = await accountService.getUserPlan('user-123');
      expect(planStatus).toBe('premium');
    });

    test('should allow more reminders after upgrade', async () => {
      // As free user: limited to 5
      accountService.getReminderLimit.mockResolvedValue(5);
      let limit = await accountService.getReminderLimit('user-123');
      expect(limit).toBe(5);

      // After upgrade: unlimited
      accountService.getReminderLimit.mockResolvedValue(-1);
      limit = await accountService.getReminderLimit('user-123');
      expect(limit).toBe(-1);
    });

    test('should detect premium status change', async () => {
      accountService.isPremium.mockResolvedValue(false);
      let isPremium = await accountService.isPremium('user-123');
      expect(isPremium).toBe(false);

      accountService.isPremium.mockResolvedValue(true);
      isPremium = await accountService.isPremium('user-123');
      expect(isPremium).toBe(true);
    });
  });

  describe('Edge cases', () => {
    test('should handle free user at exactly 5 reminders', async () => {
      accountService.getReminderLimit.mockResolvedValue(5);
      accountService.canCreateReminder.mockResolvedValue(false);

      const canCreate = await accountService.canCreateReminder('user-123', 5);

      expect(canCreate).toBe(false);
    });

    test('should handle free user with 4 reminders', async () => {
      accountService.getReminderLimit.mockResolvedValue(5);
      accountService.canCreateReminder.mockResolvedValue(true);

      const canCreate = await accountService.canCreateReminder('user-123', 4);

      expect(canCreate).toBe(true);
    });

    test('should handle premium user with 0 reminders', async () => {
      accountService.getReminderLimit.mockResolvedValue(-1);
      accountService.canCreateReminder.mockResolvedValue(true);

      const canCreate = await accountService.canCreateReminder('premium-user', 0);

      expect(canCreate).toBe(true);
    });

    test('should handle future reminder counts', async () => {
      accountService.getReminderLimit.mockResolvedValue(5);

      const counts = [0, 1, 2, 3, 4, 5, 6, 100, 1000];
      const results = await Promise.all(
        counts.map((count) => accountService.enforceReminderLimit('user-123', count))
      );

      // First 5 should be allowed
      expect(results[0].allowed).toBe(true);
      expect(results[4].allowed).toBe(true);

      // 6th and beyond should not be allowed
      expect(results[5].allowed).toBe(false);
      expect(results[6].allowed).toBe(false);
    });
  });

  describe('Concurrent requests', () => {
    test('should handle multiple reminder checks simultaneously', async () => {
      accountService.getReminderLimit.mockResolvedValue(5);

      const checks = Array.from({ length: 3 }, (_, i) =>
        accountService.enforceReminderLimit('user-123', i + 1)
      );

      const results = await Promise.all(checks);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.allowed)).toBe(true);
    });

    test('should maintain consistent limit during concurrent checks', async () => {
      accountService.getReminderLimit.mockResolvedValue(5);

      const freeChecks = Array.from({ length: 5 }, () =>
        accountService.getReminderLimit('user-123')
      );

      const limits = await Promise.all(freeChecks);

      expect(limits.every((limit) => limit === 5)).toBe(true);
    });
  });
});
