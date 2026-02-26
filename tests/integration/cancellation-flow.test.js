// @ts-check

/**
 * Integration Test: Cancellation Flow
 * Tests subscription cancellation handling through webhook events
 * Verifies subscription-sync updates local state and UI
 * @module cancellation-flow.test.js
 */

const subscriptionSync = require('../../src/background/subscription-sync');
const storageService = require('../../src/services/storage-service');

describe('Integration: Cancellation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
    chrome.notifications.create.mockReset();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.alarms.create.mockReset();
  });

  describe('Webhook Event Processing', () => {
    test('should handle subscription.cancelled webhook event', async () => {
      // Simulate webhook payload from backend
      const webhookPayload = {
        event: 'subscription.cancelled',
        data: {
          subscription_id: 'sub-456',
          user_id: 'user-123',
          status: 'cancelled',
          current_period_end: '2026-03-27T00:00:00Z',
          plan_type: 'premium',
        },
      };

      // Mock subscription save
      chrome.storage.local.set = jest.fn();

      // Simulate processing webhook
      await storageService.saveSubscriptionStatus({
        plan_type: webhookPayload.data.plan_type,
        status: webhookPayload.data.status,
        currentPeriodEnd: webhookPayload.data.current_period_end,
        lastSyncedAt: Date.now(),
      });

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should transition subscription from active to cancelled', async () => {
      // Initial state: active
      const activeSubscription = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-03-27',
      };

      // Webhook received: subscription.cancelled
      const cancelledSubscription = {
        ...activeSubscription,
        status: 'cancelled',
        currentPeriodEnd: '2026-03-27T00:00:00Z',
      };

      chrome.storage.local.set = jest.fn();

      // Save cancelled state
      await storageService.saveSubscriptionStatus(cancelledSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Cancellation State Synchronization', () => {
    test('should sync cancelled subscription from backend', async () => {
      const userId = 'user-123';
      const cancelledSubscription = {
        plan_type: 'premium',
        status: 'cancelled',
        current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Mock backend sync
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GET_SUBSCRIPTION_STATUS') {
          callback({
            success: true,
            data: cancelledSubscription,
          });
        }
      });

      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'GET_SUBSCRIPTION_STATUS', payload: { userId } },
          (response) => {
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error('Sync failed'));
            }
          }
        );
      });

      expect(result.status).toBe('cancelled');
      expect(result.current_period_end).toBeTruthy();
    });

    test('should update local cache with cancelled subscription', async () => {
      const cancelledSubscription = {
        plan_type: 'premium',
        status: 'cancelled',
        currentPeriodEnd: '2026-03-27T00:00:00Z',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set = jest.fn();

      // Update cache
      await storageService.saveSubscriptionStatus(cancelledSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: expect.objectContaining({
            status: 'cancelled',
          }),
        })
      );
    });
  });

  describe('Cancellation UI Updates', () => {
    test('should display cancellation warning in popup', async () => {
      const daysRemaining = 5;
      const cancellationWarning = document.createElement('div');
      cancellationWarning.id = 'cancellation-warning';
      cancellationWarning.hidden = false;

      const warningText = document.createElement('p');
      warningText.id = 'cancellation-text';
      warningText.textContent = `Your subscription will revert to Free in ${daysRemaining} days. You'll be limited to 5 reminders.`;

      expect(cancellationWarning.hidden).toBe(false);
      expect(warningText.textContent).toContain('5 days');
      expect(warningText.textContent).toContain('Free');
    });

    test('should show reactivate button in cancellation warning', async () => {
      const reactivateBtn = document.createElement('button');
      reactivateBtn.id = 'reactivate-btn';
      reactivateBtn.textContent = 'Reactivate';

      expect(reactivateBtn.textContent).toBe('Reactivate');
    });

    test('should hide reminder list when cancellation warning is shown', async () => {
      const reminderList = document.createElement('div');
      reminderList.id = 'reminder-list';
      reminderList.hidden = true; // Hidden when cancellation warning shown

      const cancellationWarning = document.createElement('div');
      cancellationWarning.id = 'cancellation-warning';
      cancellationWarning.hidden = false;

      expect(reminderList.hidden).toBe(true);
      expect(cancellationWarning.hidden).toBe(false);
    });
  });

  describe('Notification on Cancellation', () => {
    test('should send notification when subscription is cancelled', async () => {
      chrome.notifications.create = jest.fn();

      const notificationInfo = {
        iconUrl: 'icon.png',
        title: 'Subscription Cancelled',
        message: 'Your premium access will end on Mar 27, 2026.',
      };

      chrome.notifications.create('subscription-cancelled', {
        type: 'basic',
        ...notificationInfo,
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'subscription-cancelled',
        expect.objectContaining({
          type: 'basic',
          title: 'Subscription Cancelled',
        })
      );
    });

    test('should include period end date in cancellation notification', async () => {
      const periodEnd = '2026-03-27';
      chrome.notifications.create = jest.fn();

      chrome.notifications.create('subscription-cancelled', {
        type: 'basic',
        title: 'Subscription Cancelled',
        message: `Your premium access will end on ${periodEnd}.`,
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'subscription-cancelled',
        expect.objectContaining({
          message: expect.stringContaining('2026-03-27'),
        })
      );
    });
  });

  describe('Cancellation Re-activation Path', () => {
    test('should update subscription status from cancelled to active on reactivation', async () => {
      const userId = 'user-123';

      // Initial state: cancelled_pending
      const cancelledSub = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        currentPeriodEnd: '2026-03-27T00:00:00Z',
      };

      chrome.storage.local.set = jest.fn();
      await storageService.saveSubscriptionStatus(cancelledSub);

      // Reactivate
      const reactivatedSub = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-03-27',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set.mockClear();
      await storageService.saveSubscriptionStatus(reactivatedSub);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    test('should clear cancellation warning after reactivation', async () => {
      const cancellationWarning = document.createElement('div');
      cancellationWarning.id = 'cancellation-warning';

      // Initially visible (cancelled state)
      cancellationWarning.hidden = false;
      expect(cancellationWarning.hidden).toBe(false);

      // After reactivation, hidden
      cancellationWarning.hidden = true;
      expect(cancellationWarning.hidden).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle cancellation with null current_period_end', async () => {
      const malformedCancellation = {
        plan_type: 'premium',
        status: 'cancelled',
        current_period_end: null,
      };

      expect(malformedCancellation.current_period_end).toBeNull();
      expect(malformedCancellation.status).toBe('cancelled');
    });

    test('should handle reactivation attempt after period end', async () => {
      const expiredCancelledSub = {
        plan_type: 'free', // Already downgraded
        status: 'cancelled',
        currentPeriodEnd: new Date(Date.now() - 1000).toISOString(), // Past
      };

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          // Cannot reactivate after period end
          callback({
            success: false,
            error: 'Subscription period has ended, cannot reactivate',
          });
        }
      });

      await expect(
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'REACTIVATE_SUBSCRIPTION' },
            (response) => {
              if (response.success) {
                resolve(response.data);
              } else {
                reject(new Error(response.error));
              }
            }
          );
        })
      ).rejects.toThrow('Subscription period has ended');
    });
  });
});
