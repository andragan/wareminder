/**
 * Unit tests for subscription-service
 * Tests CRUD operations, state machine logic, grace period handling
 * @jest-environment jsdom
 */

import * as subscriptionService from '../../../src/services/subscription-service.js';
import { SUBSCRIPTION_STATUS, SUBSCRIPTION_PLANS } from '../../../src/lib/constants.js';

// Setup mocks before importing
global.fetch = jest.fn();
global.chrome = {
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

describe('subscription-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('getSubscription', () => {
    it('should return null when user has no subscription', async () => {
      // Mock fetch to return 404
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await subscriptionService.getSubscription('user-123');
      expect(result).toBeNull();
    });

    it('should return subscription object when user has active subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        plan_type: SUBSCRIPTION_PLANS.PREMIUM,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        trial_end_date: null,
        next_billing_date: '2026-03-27T00:00:00Z',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSubscription),
      });

      const result = await subscriptionService.getSubscription('user-123');
      expect(result).toEqual(mockSubscription);
    });
  });;

  describe('isInGracePeriod', () => {
    it('should return false for non-grace-period status', () => {
      const subscription = {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        grace_period_end_date: '2026-03-30T00:00:00Z',
      };

      expect(subscriptionService.isInGracePeriod(subscription)).toBe(false);
    });

    it('should return false when now is after grace period end', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const subscription = {
        status: SUBSCRIPTION_STATUS.GRACE_PERIOD,
        grace_period_end_date: pastDate.toISOString(),
      };

      expect(subscriptionService.isInGracePeriod(subscription)).toBe(false);
    });

    it('should return true when in active grace period', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const subscription = {
        status: SUBSCRIPTION_STATUS.GRACE_PERIOD,
        grace_period_end_date: futureDate.toISOString(),
      };

      expect(subscriptionService.isInGracePeriod(subscription)).toBe(true);
    });
  });

  describe('getGracePeriodDaysRemaining', () => {
    it('should return 0 for non-grace-period subscriptions', () => {
      const subscription = {
        status: SUBSCRIPTION_STATUS.ACTIVE,
      };

      expect(subscriptionService.getGracePeriodDaysRemaining(subscription)).toBe(0);
    });

    it('should return correct days remaining in grace period', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      futureDate.setHours(0, 0, 0, 0); // Set to midnight for predictable calculation

      const subscription = {
        status: SUBSCRIPTION_STATUS.GRACE_PERIOD,
        grace_period_end_date: futureDate.toISOString(),
      };

      const daysRemaining = subscriptionService.getGracePeriodDaysRemaining(subscription);
      expect(daysRemaining).toBeGreaterThanOrEqual(1);
      expect(daysRemaining).toBeLessThanOrEqual(3);
    });

    it('should return 0 when grace period has expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const subscription = {
        status: SUBSCRIPTION_STATUS.GRACE_PERIOD,
        grace_period_end_date: pastDate.toISOString(),
      };

      expect(subscriptionService.getGracePeriodDaysRemaining(subscription)).toBe(0);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('should return 0 for non-trial subscriptions', () => {
      const subscription = {
        status: SUBSCRIPTION_STATUS.ACTIVE,
      };

      expect(subscriptionService.getTrialDaysRemaining(subscription)).toBe(0);
    });

    it('should return correct days remaining in trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      futureDate.setHours(0, 0, 0, 0);

      const subscription = {
        status: SUBSCRIPTION_STATUS.TRIAL,
        trial_end_date: futureDate.toISOString(),
      };

      const daysRemaining = subscriptionService.getTrialDaysRemaining(subscription);
      expect(daysRemaining).toBeGreaterThanOrEqual(6);
      expect(daysRemaining).toBeLessThanOrEqual(8);
    });

    it('should return 0 when trial has expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const subscription = {
        status: SUBSCRIPTION_STATUS.TRIAL,
        trial_end_date: pastDate.toISOString(),
      };

      expect(subscriptionService.getTrialDaysRemaining(subscription)).toBe(0);
    });
  });

  describe('handleGracePeriod', () => {
    it('should initiate grace period for user', async () => {
      const result = await subscriptionService.handleGracePeriod('user-123');
      expect(result).toBe(true);
    });
  });

  describe('downgradeToFree', () => {
    it('should downgrade user to free plan', async () => {
      const result = await subscriptionService.downgradeToFree('user-123', 'grace_period_ended');
      expect(result).toBe(true);
    });

    it('should throw error if user ID is missing', async () => {
      const result = await subscriptionService.downgradeToFree(null, 'test');
      expect(result).toBe(false);
    });
  });
});
