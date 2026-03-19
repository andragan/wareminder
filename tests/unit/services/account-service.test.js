// @ts-check
/**
 * Unit tests for account-service
 * Tests plan type checking, reminder limit enforcement, subscription sync
 * @jest-environment jsdom
 */

import * as accountService from '../../../src/services/account-service.js';
import { SUBSCRIPTION_PLANS, PLAN_LIMITS } from '../../../src/lib/constants.js';

global.fetch = jest.fn();
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, cb) => cb({})),
      set: jest.fn((obj, cb) => cb?.()),
    },
  },
  identity: {
    getAuthToken: jest.fn((opts, cb) => {
      setTimeout(() => cb('mock-token'), 10);
    }),
  },
  runtime: {
    lastError: null,
  },
};
process.env.SUPABASE_URL = 'https://test.supabase.co';

describe('account-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    // @ts-ignore
    chrome.storage.local.get.mockClear();
    // @ts-ignore
    chrome.storage.local.set.mockClear();
  });

  describe('getUserPlan', () => {
    it('should return free plan by default', async () => {
      // @ts-ignore
       chrome.storage.local.get.mockImplementationOnce(() =>
         Promise.resolve({})
       );

      const plan = await accountService.getUserPlan('user-123');
      expect(plan).toBe(SUBSCRIPTION_PLANS.FREE);
    });

    it('should return premium plan when cached', async () => {
      // @ts-ignore
       chrome.storage.local.get.mockImplementationOnce(() =>
         Promise.resolve({
           subscriptionStatus: {
             plan_type: SUBSCRIPTION_PLANS.PREMIUM,
           },
         })
       );

      const plan = await accountService.getUserPlan('user-123');
      expect(plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
    });
  });

  describe('isPremium', () => {
    it('should return true for premium plan', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.PREMIUM,
            },
          })
        );

      const isPremium = await accountService.isPremium('user-123');
      expect(isPremium).toBe(true);
    });

    it('should return false for free plan', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const isPremium = await accountService.isPremium('user-123');
      expect(isPremium).toBe(false);
    });
  });

  describe('getReminderLimit', () => {
    it('should return 5 reminders for free plan', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const limit = await accountService.getReminderLimit('user-123');
      expect(limit).toBe(PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT);
      expect(limit).toBe(5);
    });

    it('should return unlimited (-1) for premium plan', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.PREMIUM,
            },
          })
        );

      const limit = await accountService.getReminderLimit('user-123');
      expect(limit).toBe(PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT);
      expect(limit).toBe(-1);
    });
  });

  describe('canCreateReminder', () => {
    it('should allow creation for free user under limit', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const canCreate = await accountService.canCreateReminder('user-123', 3);
      expect(canCreate).toBe(true);
    });

    it('should deny creation for free user at limit', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const canCreate = await accountService.canCreateReminder('user-123', 5);
      expect(canCreate).toBe(false);
    });

    it('should allow unlimited creation for premium user', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.PREMIUM,
            },
          })
        );

      const canCreate = await accountService.canCreateReminder('user-123', 1000);
      expect(canCreate).toBe(true);
    });
  });

  describe('enforceReminderLimit', () => {
    it('should return allowed for free user under limit', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const result = await accountService.enforceReminderLimit('user-123', 3);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.limit).toBe(5);
    });

    it('should return error for free user at limit', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.FREE,
            },
          })
        );

      const result = await accountService.enforceReminderLimit('user-123', 5);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('reached the limit');
      expect(result.error).toContain('Upgrade');
      expect(result.limit).toBe(5);
    });

    it('should return allowed for premium user', async () => {
      // @ts-ignore
          chrome.storage.local.get.mockImplementation(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.PREMIUM,
            },
          })
        );

      const result = await accountService.enforceReminderLimit('user-123', 50);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getCachedSubscription', () => {
    it('should return default free plan when no cache', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({})
        );

      const subscription = await accountService.getCachedSubscription();
      expect(subscription.plan_type).toBe(SUBSCRIPTION_PLANS.FREE);
      expect(subscription.status).toBe('active');
    });

    it('should return cached subscription data', async () => {
      // @ts-ignore
        chrome.storage.local.get.mockImplementationOnce(() =>
          Promise.resolve({
            subscriptionStatus: {
              plan_type: SUBSCRIPTION_PLANS.PREMIUM,
              status: 'trial',
              trial_end_date: '2026-03-13T00:00:00Z',
            },
          })
        );

      const subscription = await accountService.getCachedSubscription();
      expect(subscription.plan_type).toBe(SUBSCRIPTION_PLANS.PREMIUM);
      expect(subscription.status).toBe('trial');
    });
  });
});
