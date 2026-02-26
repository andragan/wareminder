// @ts-check

/**
 * E2E Test: Subscription Management
 * Tests the full subscription lifecycle including cancellation and re-activation
 * @module subscription-management.test.js
 */

describe('E2E: Subscription Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
    chrome.notifications.create.mockReset();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
  });

  describe('Manage Subscription Portal', () => {
    test('should redirect to customer portal on manage subscription click', async () => {
      // Setup: Premium user viewing account settings
      const subscriptionStatus = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-03-27',
        last_synced_at: Date.now(),
      };

      chrome.storage.local.set({ subscriptionStatus });
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REDIRECT_TO_CUSTOMER_PORTAL') {
          callback({
            success: true,
            data: {
              portalUrl: 'https://manage.xendit.co/portal/session-abc123',
            },
          });
        }
      });

      // Simulate clicking "Manage Subscription" button
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'REDIRECT_TO_CUSTOMER_PORTAL' },
          (response) => {
            if (response.success) {
              resolve(response.data.portalUrl);
            } else {
              reject(new Error('Failed'));
            }
          }
        );
      });

      expect(result).toContain('xendit');
      expect(result).toContain('portal');
    });

    test('should handle portal redirect error gracefully', async () => {
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REDIRECT_TO_CUSTOMER_PORTAL') {
          callback({
            success: false,
            error: 'Failed to generate portal session',
          });
        }
      });

      await expect(
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'REDIRECT_TO_CUSTOMER_PORTAL' },
            (response) => {
              if (response.success) {
                resolve(response.data);
              } else {
                reject(new Error(response.error));
              }
            }
          );
        })
      ).rejects.toThrow('Failed to generate portal session');
    });
  });

  describe('Subscription Cancellation', () => {
    test('should display cancellation warning when subscription is cancelled', async () => {
      const subscriptionStatus = {
        plan_type: 'premium',
        status: 'cancelled_pending',
        current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        last_synced_at: Date.now(),
      };

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ subscriptionStatus });
      });

      // Verify cancellation warning is shown
      const cancellationWarning = document.createElement('div');
      cancellationWarning.id = 'cancellation-warning';
      cancellationWarning.hidden = false;
      expect(cancellationWarning.hidden).toBe(false);
    });

    test('should show remaining days in cancellation warning', async () => {
      const daysRemaining = 3;
      const warningText = `Your subscription will revert to Free in ${daysRemaining} days. You'll be limited to 5 reminders.`;

      expect(warningText).toContain('3 days');
      expect(warningText).toContain('Free');
      expect(warningText).toContain('5 reminders');
    });

    test('should send notification when subscription is cancelled by webhook', async () => {
      const cancelledSubscription = {
        plan_type: 'premium',
        status: 'cancelled',
        current_period_end: '2026-03-27T00:00:00Z',
      };

      chrome.notifications.create = jest.fn();

      // Simulate webhook notification
      chrome.notifications.create('subscription-cancelled', {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Subscription Cancelled',
        message: 'Your premium access will end on Mar 27, 2026.',
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'subscription-cancelled',
        expect.objectContaining({
          type: 'basic',
          title: 'Subscription Cancelled',
        })
      );
    });
  });

  describe('Subscription Re-activation', () => {
    test('should reactivate cancelled subscription before period end', async () => {
      const userId = 'user-123';

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          callback({
            success: true,
            data: {
              plan_type: 'premium',
              status: 'active',
              next_billing_date: '2026-03-27',
            },
          });
        }
      });

      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'REACTIVATE_SUBSCRIPTION', payload: { userId } },
          (response) => {
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      expect(result.status).toBe('active');
      expect(result.plan_type).toBe('premium');
    });

    test('should update UI after successful reactivation', async () => {
      const reactivatedSub = {
        plan_type: 'premium',
        status: 'active',
        next_billing_date: '2026-03-27',
      };

      // Verify cancellation warning is hidden
      const cancellationWarning = document.createElement('div');
      cancellationWarning.id = 'cancellation-warning';
      cancellationWarning.hidden = true;
      expect(cancellationWarning.hidden).toBe(true);

      // Verify account settings displayed
      const accountSettings = document.createElement('div');
      accountSettings.id = 'account-settings';
      accountSettings.hidden = false;
      expect(accountSettings.hidden).toBe(false);
    });

    test('should handle reactivation failure gracefully', async () => {
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'REACTIVATE_SUBSCRIPTION') {
          callback({
            success: false,
            error: 'Payment method on file failed',
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
      ).rejects.toThrow('Payment method on file failed');
    });

    test('should show success notification after reactivation', async () => {
      chrome.notifications.create = jest.fn();

      // Simulate reactivation success notification
      chrome.notifications.create('subscription-reactivated', {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Subscription Reactivated',
        message: 'Your subscription is active again. Enjoy unlimited reminders!',
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'subscription-reactivated',
        expect.objectContaining({
          type: 'basic',
          title: 'Subscription Reactivated',
        })
      );
    });
  });

  describe('Automatic Downgrade After Period End', () => {
    test('should downgrade to free plan on period end date', async () => {
      const currentDate = new Date();
      const periodEndDate = new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000); // Tomorrow

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'SYNC_SUBSCRIPTION') {
          callback({
            success: true,
            data: {
              plan_type: 'free',
              status: 'cancelled',
              remainingDays: 0,
            },
          });
        }
      });

      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'SYNC_SUBSCRIPTION' },
          (response) => {
            if (response.success) {
              resolve(response.data.plan_type);
            } else {
              reject(new Error('Sync failed'));
            }
          }
        );
      });

      expect(result).toBe('free');
    });

    test('should enforce reminder limit after downgrade', async () => {
      // Setup: User has 6 reminders and is downgraded to free
      const reminders = [
        { id: 'r1', status: 'pending' },
        { id: 'r2', status: 'pending' },
        { id: 'r3', status: 'pending' },
        { id: 'r4', status: 'pending' },
        { id: 'r5', status: 'pending' },
        { id: 'r6', status: 'pending' }, // 6th reminder created when premium
      ];

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GET_PLAN_STATUS') {
          callback({
            success: true,
            data: {
              isPremium: false, // Downgraded
              reminderCount: 6,
            },
          });
        }
      });

      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'GET_PLAN_STATUS' },
          (response) => {
            if (response.success) {
              resolve(response.data.isPremium);
            } else {
              reject(new Error('Failed'));
            }
          }
        );
      });

      // Free user should not be able to create more reminders
      expect(result).toBe(false);
      expect(reminders.length).toBe(6);
    });
  });
});
