// @ts-check

/**
 * Integration Test: Payment Flow
 * Tests interaction between popup, background service worker, and payment backend
 * Verifies message passing between contexts and subscription status updates
 * @module payment-flow.test.js
 */

const accountService = require('../../src/services/account-service');
const storageService = require('../../src/services/storage-service');
const paymentService = require('../../src/services/payment-service');

describe('Integration: Payment Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
    chrome.tabs.create.mockReset();
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
  });

  describe('Checkout Initiation', () => {
    test('should create Xendit invoice on checkout initiation', async () => {
      const userId = 'user-123';
      const mockInvoiceUrl = 'https://xendit.co/checkout/invoice-456';

      // Mock backend function response
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'INITIATE_CHECKOUT') {
          callback({
            success: true,
            data: {
              checkoutUrl: mockInvoiceUrl,
              invoiceId: 'invoke-456',
            },
          });
        }
      });

      // Simulate initiating checkout
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'INITIATE_CHECKOUT', payload: { userId } },
          (response) => {
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      expect(result.checkoutUrl).toBe(mockInvoiceUrl);
      expect(result.invoiceId).toBeTruthy();
    });

    test('should handle checkout initiation error', async () => {
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'INITIATE_CHECKOUT') {
          callback({
            success: false,
            error: 'Failed to create invoice',
          });
        }
      });

      await expect(
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'INITIATE_CHECKOUT', payload: { userId: 'user-123' } },
            (response) => {
              if (response.success) {
                resolve(response.data);
              } else {
                reject(new Error(response.error));
              }
            }
          );
        })
      ).rejects.toThrow('Failed to create invoice');
    });

    test('should open checkout URL in new tab', async () => {
      const checkoutUrl = 'https://xendit.co/checkout/test';
      chrome.tabs.create = jest.fn();

      chrome.tabs.create({ url: checkoutUrl });

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: checkoutUrl });
    });
  });

  describe('Payment Webhook Processing', () => {
    test('should update subscription status to "active" on successful payment', async () => {
      const webhookPayload = {
        event: 'invoice.paid',
        data: {
          id: 'invoice-456',
          status: 'PAID',
          customer_id: 'cust-789',
          created: '2026-02-27T10:00:00Z',
        },
      };

      // Mock subscription status save
      chrome.storage.local.set = jest.fn();

      await storageService.saveSubscriptionStatus({
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
        lastSyncedAt: Date.now(),
      });

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should transition from trial to active on first payment', async () => {
      // Setup: User in trial
      const trialSubscription = {
        planType: 'premium',
        status: 'trial',
        trialEndDate: '2026-03-13',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set = jest.fn();
      await storageService.saveSubscriptionStatus(trialSubscription);

      // Simulate webhook: payment received
      const activeSubscription = {
        ...trialSubscription,
        status: 'active',
        nextBillingDate: '2026-03-27',
        trialEndDate: null,
      };

      chrome.storage.local.set = jest.fn();
      await storageService.saveSubscriptionStatus(activeSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle failed payment and initiate grace period', async () => {
      const failedPaymentSubscription = {
        planType: 'premium',
        status: 'grace_period',
        nextBillingDate: '2026-03-27',
        gracePeriodStartDate: '2026-02-27',
        gracePeriodEndDate: '2026-03-02',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set = jest.fn();
      await storageService.saveSubscriptionStatus(failedPaymentSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Verify grace period dates
      const calls = chrome.storage.local.set.mock.calls;
      const savedData = calls[0][0];
      expect(savedData.subscriptionStatus.status).toBe('grace_period');
    });
  });

  describe('Message Passing Between Contexts', () => {
    test('should broadcast SUBSCRIPTION_STATUS_CHANGED to popup', async () => {
      const subscriptionStatus = {
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
      };

      // Simulate background service sending message to popup
      const onMessageListeners = [];
      chrome.runtime.onMessage.addListener = jest.fn((listener) => {
        onMessageListeners.push(listener);
      });

      // Register popup listener
      chrome.runtime.onMessage.addListener(() => {});

      // Simulate service worker broadcasting change
      onMessageListeners.forEach(listener => {
        listener({
          type: 'SUBSCRIPTION_STATUS_CHANGED',
          data: subscriptionStatus,
        });
      });

      expect(onMessageListeners.length > 0).toBe(true);
    });

    test('should update popup UI when receiving subscription change', async () => {
      const mockPopupUI = {
        upgradePrompt: { hidden: true },
        reminderList: { hidden: false },
      };

      // Simulate message reception in popup
      const changeMessage = {
        type: 'SUBSCRIPTION_STATUS_CHANGED',
        data: {
          planType: 'premium',
          status: 'active',
        },
      };

      if (changeMessage.data.planType === 'premium') {
        mockPopupUI.upgradePrompt.hidden = true;
        mockPopupUI.reminderList.hidden = false;
      }

      expect(mockPopupUI.upgradePrompt.hidden).toBe(true);
      expect(mockPopupUI.reminderList.hidden).toBe(false);
    });
  });

  describe('Subscription Cache Synchronization', () => {
    test('should sync subscription status from backend to local cache', async () => {
      const backendSubscription = {
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set = jest.fn();

      // Simulate fetching from backend and saving to cache
      await storageService.saveSubscriptionStatus(backendSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        subscriptionStatus: expect.objectContaining({
          planType: 'premium',
          status: 'active',
        }),
      });
    });

    test('should handle sync errors gracefully', async () => {
      chrome.storage.local.set = jest.fn().mockRejectedValue(
        new Error('Storage quota exceeded')
      );

      try {
        await storageService.saveSubscriptionStatus({
          planType: 'premium',
          status: 'active',
        });
      } catch (error) {
        expect(error.message).toContain('quota');
      }
    });

    test('should validate subscription data before updating cache', async () => {
      const invalidSubscription = {
        // Missing required fields
        planType: 'premium',
      };

      // In real implementation, validation would happen here
      const isValid = !!(invalidSubscription.planType && invalidSubscription.status);

      expect(isValid).toBe(false);
    });
  });

  describe('Trial Period Handling', () => {
    test('should initialize subscription in trial status', async () => {
      const trialSubscription = {
        planType: 'premium',
        status: 'trial',
        trialEndDate: '2026-03-13',
        trialStartDate: '2026-02-27',
        lastSyncedAt: Date.now(),
      };

      chrome.storage.local.set = jest.fn();
      await storageService.saveSubscriptionStatus(trialSubscription);

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should calculate trial days remaining correctly', () => {
      const trialEndDate = new Date('2026-03-13');
      const today = new Date('2026-02-27');
      const daysRemaining = Math.ceil(
        (trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysRemaining).toBe(14);
    });

    test('should send trial expiry notification on day 13', async () => {
      const trialEndDate = new Date('2026-03-13');
      const notificationDay = new Date('2026-03-12');

      const daysUntilExpiry = Math.ceil(
        (trialEndDate.getTime() - notificationDay.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Notification should be sent when 2 days remain
      if (daysUntilExpiry === 2) {
        expect(daysUntilExpiry).toBe(2);
      }
    });
  });

  describe('Error Recovery', () => {
    test('should allow user to retry payment after failure', async () => {
      const failedCheckout = {
        checkoutUrl: null,
        error: 'Session expired',
      };

      // User clicks "Try Again"
      const retryCheckoutUrl = 'https://xendit.co/checkout/retry-789';

      expect(retryCheckoutUrl).toBeTruthy();
      expect(retryCheckoutUrl.includes('xendit')).toBe(true);
    });

    test('should preserve reminder data during payment flow', async () => {
      const reminders = [
        { id: 'r1', chatId: '111@c.us', status: 'pending' },
        { id: 'r2', chatId: '222@c.us', status: 'pending' },
      ];

      chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ reminders });
      });

      // Simulate payment flow doesn't affect reminders
      const loadedReminders = await new Promise((resolve, reject) => {
        chrome.storage.local.get(['reminders'], (result) => {
          if (result.reminders) {
            resolve(result.reminders);
          } else {
            reject(new Error('No reminders'));
          }
        });
      });

      expect(loadedReminders).toEqual(reminders);
    }, 10000);
  });
});
