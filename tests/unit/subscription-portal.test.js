// @ts-check

/**
 * Unit Test: Subscription Portal Service
 * Tests portal session generation, cancellation handling, and re-activation logic
 * @module subscription-portal.test.js
 */

const subscriptionPortalService = require('../../src/services/subscription-portal-service');
const storageService = require('../../src/services/storage-service');

describe('Unit: Subscription Portal Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
  });

  describe('generatePortalSessionLink', () => {
    test('should generate portal session link for user', async () => {
      const userId = 'user-123';
      const portalUrl = 'https://manage.xendit.co/portal/session-abc123';

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GENERATE_PORTAL_SESSION') {
          callback({
            success: true,
            data: { portalUrl },
          });
        }
      });

      const result = await subscriptionPortalService.generatePortalSessionLink(userId);

      expect(result).toBe(portalUrl);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GENERATE_PORTAL_SESSION',
          payload: { userId },
        }),
        expect.any(Function)
      );
    });

    test('should reject on portal generation error', async () => {
      const userId = 'user-123';

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GENERATE_PORTAL_SESSION') {
          callback({
            success: false,
            error: 'Failed to generate portal session',
          });
        }
      });

      await expect(subscriptionPortalService.generatePortalSessionLink(userId)).rejects.toThrow(
        'Failed to generate portal session'
      );
    });

    test('should handle chrome runtime error', async () => {
      const userId = 'user-123';

      chrome.runtime.lastError = { message: 'Runtime error' };
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        callback(undefined);
      });

      await expect(subscriptionPortalService.generatePortalSessionLink(userId)).rejects.toThrow(
        'Runtime error'
      );
    });
  });

  describe('handleCancellation', () => {
    test('should update subscription status on cancellation', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled',
        current_period_end: '2026-03-27T00:00:00Z',
        next_billing_date: null,
      };

      chrome.storage.local.set = jest.fn();
      chrome.runtime.sendMessage = jest.fn();

      await subscriptionPortalService.handleCancellation(subscription);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: expect.objectContaining({
            status: 'cancelled',
            planType: 'premium',
          }),
        })
      );
    });

    test('should notify popup of cancellation', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled',
        current_period_end: '2026-03-27T00:00:00Z',
      };

      chrome.storage.local.set = jest.fn();
      chrome.runtime.sendMessage = jest.fn();

      await subscriptionPortalService.handleCancellation(subscription);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION_CANCELLED',
        }),
        expect.any(Function)
      );
    });

    test('should reject on invalid cancellation status', async () => {
      const invalidSubscription = {
        plan_type: 'premium',
        status: 'active', // Should be 'cancelled' or 'cancelled_pending'
      };

      await expect(subscriptionPortalService.handleCancellation(invalidSubscription)).rejects.toThrow(
        'Invalid cancellation status'
      );
    });

    test('should accept cancelled_pending status', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        current_period_end: '2026-03-27T00:00:00Z',
      };

      chrome.storage.local.set = jest.fn();
      chrome.runtime.sendMessage = jest.fn();

      // Should not throw
      await subscriptionPortalService.handleCancellation(subscription);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('reactivateSubscription', () => {
    test('should call reactivate backend function', async () => {
      const userId = 'user-123';
      const reactivatedSub = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-04-27',
      };

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          callback({
            success: true,
            data: reactivatedSub,
          });
        }
      });

      const result = await subscriptionPortalService.reactivateSubscription(userId);

      expect(result).toEqual(reactivatedSub);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REACTIVATE_SUBSCRIPTION',
          payload: { userId },
        }),
        expect.any(Function)
      );
    });

    test('should update cache with reactivated subscription', async () => {
      const userId = 'user-123';
      const reactivatedSub = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-04-27',
      };

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          setTimeout(() => {
            callback({
              success: true,
              data: reactivatedSub,
            });
          }, 10);
        }
      });

      chrome.storage.local.set = jest.fn();

      await subscriptionPortalService.reactivateSubscription(userId);

      // Allow async storage update to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cache should be updated
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should reject on reactivation error', async () => {
      const userId = 'user-123';

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          callback({
            success: false,
            error: 'Payment method failed',
          });
        }
      });

      await expect(subscriptionPortalService.reactivateSubscription(userId)).rejects.toThrow(
        'Payment method failed'
      );
    });
  });

  describe('getCancellationDetails', () => {
    test('should return cancellation details for cancelled subscription', async () => {
      const dayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        currentPeriodEnd: dayFromNow.toISOString(),
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus: subscription });
      });

      const details = await subscriptionPortalService.getCancellationDetails();

      expect(details).toBeTruthy();
      expect(details.currentPeriodEnd).toBeTruthy();
      expect(details.status).toBe('cancelled_pending');
      expect(details.daysRemaining).toBeGreaterThan(0);
    });

    test('should return null for active subscription', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'active',
        nextBillingDate: '2026-04-27',
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus: subscription });
      });

      const details = await subscriptionPortalService.getCancellationDetails();

      expect(details).toBeNull();
    });

    test('should return null if no subscription found', async () => {
      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({});
      });

      const details = await subscriptionPortalService.getCancellationDetails();

      expect(details).toBeNull();
    });

    test('should calculate days remaining correctly', async () => {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        currentPeriodEnd: threeDaysFromNow.toISOString(),
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus: subscription });
      });

      const details = await subscriptionPortalService.getCancellationDetails();

      expect(details.daysRemaining).toBeLessThanOrEqual(3);
      expect(details.daysRemaining).toBeGreaterThanOrEqual(2); // Allow for execution time
    });
  });

  describe('isSubscriptionCancelled', () => {
    test('should return true for cancelled_pending subscription', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        currentPeriodEnd: '2026-03-27T00:00:00Z',
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus: subscription });
      });

      const isCancelled = await subscriptionPortalService.isSubscriptionCancelled();

      expect(isCancelled).toBe(true);
    });

    test('should return false for active subscription', async () => {
      const subscription = {
        plan_type: 'premium',
        status: 'active',
        nextBillingDate: '2026-04-27',
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus: subscription });
      });

      const isCancelled = await subscriptionPortalService.isSubscriptionCancelled();

      expect(isCancelled).toBe(false);
    });

    test('should return false if no subscription found', async () => {
      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({});
      });

      const isCancelled = await subscriptionPortalService.isSubscriptionCancelled();

      expect(isCancelled).toBe(false);
    });

    test('should return false on storage error', async () => {
      chrome.storage.local.get = jest.fn((keys, callback) => {
        throw new Error('Storage error');
      });

      const isCancelled = await subscriptionPortalService.isSubscriptionCancelled();

      expect(isCancelled).toBe(false);
    });
  });
});
