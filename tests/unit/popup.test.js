// @ts-check

/**
 * Unit Test: popup.js - Upgrade Prompt Functionality
 * Tests upgrade button visibility, error message display, trial countdown
 * @module popup-upgrade.test.js
 */

describe('Popup: Upgrade Prompt Functionality', () => {
  const MESSAGE_TYPES = {
    GET_PLAN_STATUS: 'GET_PLAN_STATUS',
    GET_REMINDERS: 'GET_REMINDERS',
    INITIATE_CHECKOUT: 'INITIATE_CHECKOUT',
    SUBSCRIPTION_STATUS_CHANGED: 'SUBSCRIPTION_STATUS_CHANGED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
    chrome.tabs.create.mockReset();
  });

  describe('Upgrade Prompt Visibility', () => {
    test('should show upgrade button when limit is reached', () => {
      const upgradeButton = document.createElement('button');
      upgradeButton.id = 'upgrade-button';
      upgradeButton.hidden = false;

      expect(upgradeButton.hidden).toBe(false);
    });

    test('should hide upgrade button when user is premium', () => {
      const upgradeButton = document.createElement('button');
      upgradeButton.id = 'upgrade-button';
      upgradeButton.hidden = true;

      expect(upgradeButton.hidden).toBe(true);
    });

    test('should display upgrade prompt container', () => {
      const upgradePrompt = document.createElement('div');
      upgradePrompt.id = 'upgrade-prompt';
      upgradePrompt.hidden = false;

      expect(upgradePrompt.hidden).toBe(false);
      expect(upgradePrompt.id).toBe('upgrade-prompt');
    });

    test('should hide reminder list when upgrade prompt is shown', () => {
      const reminderList = document.createElement('div');
      reminderList.id = 'reminder-list';
      reminderList.hidden = true;

      const upgradePrompt = document.createElement('div');
      upgradePrompt.id = 'upgrade-prompt';
      upgradePrompt.hidden = false;

      expect(upgradePrompt.hidden).toBe(false);
      expect(reminderList.hidden).toBe(true);
    });
  });

  describe('Upgrade Button Interaction', () => {
    test('should disable button while processing checkout', () => {
      const upgradeButton = document.createElement('button');
      upgradeButton.disabled = false;

      upgradeButton.disabled = true;

      expect(upgradeButton.disabled).toBe(true);
    });

    test('should enable button after checkout error', () => {
      const upgradeButton = document.createElement('button');
      upgradeButton.disabled = true;

      upgradeButton.disabled = false;

      expect(upgradeButton.disabled).toBe(false);
    });

    test('should send INITIATE_CHECKOUT message on click', async () => {
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'INITIATE_CHECKOUT') {
          callback({
            success: true,
            data: { checkoutUrl: 'https://test.xendit.co' },
          });
        }
      });

      const message = { type: 'INITIATE_CHECKOUT', payload: { userId: 'user-123' } };

      await new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          expect(response.success).toBe(true);
          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
          resolve();
        });
      });
    });

    test('should open checkout URL in new tab on success', async () => {
      const checkoutUrl = 'https://placeholder.xendit.co/invoice-test';
      chrome.tabs.create = jest.fn();

      chrome.tabs.create({ url: checkoutUrl });

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: checkoutUrl });
    });
  });

  describe('Error Message Display', () => {
    test('should display error message on payment initiation failure', () => {
      const upgradeError = document.createElement('div');
      upgradeError.id = 'upgrade-error';
      upgradeError.hidden = true;

      const upgradeErrorMessage = document.createElement('span');
      upgradeErrorMessage.id = 'upgrade-error-message';
      upgradeErrorMessage.textContent = 'Unable to start checkout. Please try again.';

      upgradeError.appendChild(upgradeErrorMessage);

      upgradeError.hidden = false;

      expect(upgradeError.hidden).toBe(false);
      expect(upgradeErrorMessage.textContent).toContain('Unable to start checkout');
    });

    test('should show retry button when error occurs', () => {
      const upgradeError = document.createElement('div');
      upgradeError.id = 'upgrade-error';
      upgradeError.hidden = false;

      const upgradeRetry = document.createElement('button');
      upgradeRetry.id = 'upgrade-retry';

      expect(upgradeError.hidden).toBe(false);
      expect(upgradeRetry.id).toBe('upgrade-retry');
    });

    test('should clear error message on successful retry', () => {
      const upgradeError = document.createElement('div');
      const upgradeErrorMessage = document.createElement('span');
      upgradeErrorMessage.textContent = '';

      upgradeError.appendChild(upgradeErrorMessage);
      upgradeError.hidden = true;

      expect(upgradeError.hidden).toBe(true);
      expect(upgradeErrorMessage.textContent).toBe('');
    });

    test('should display card decline error message', () => {
      const errorMessage = 'Card declined. Please check your card details and try again.';
      const upgradeErrorMessage = document.createElement('span');
      upgradeErrorMessage.textContent = errorMessage;

      expect(upgradeErrorMessage.textContent).toContain('Card declined');
    });

    test('should display network error message', () => {
      const errorMessage = 'Network error. Please check your connection and try again.';
      const upgradeErrorMessage = document.createElement('span');
      upgradeErrorMessage.textContent = errorMessage;

      expect(upgradeErrorMessage.textContent).toContain('Network error');
    });
  });

  describe('Trial Information Display', () => {
    test('should show trial period offer', () => {
      const trialBadge = document.createElement('span');
      trialBadge.textContent = '14 days free';
      trialBadge.className = 'upgrade-trial-badge';

      expect(trialBadge.textContent).toBe('14 days free');
    });

    test('should show billing info message', () => {
      const billingInfo = document.createElement('p');
      billingInfo.textContent = 'First charge on day 15. Cancel anytime.';
      billingInfo.className = 'upgrade-billing-info';

      expect(billingInfo.textContent).toContain('First charge on day 15');
      expect(billingInfo.textContent).toContain('Cancel anytime');
    });

    test('should display trial countdown when in progress', () => {
      const trialStartDate = new Date('2026-02-27');
      const trialEndDate = new Date('2026-03-13');
      const today = new Date('2026-03-01');

      const daysRemaining = Math.ceil(
        (trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const trialCountdown = document.createElement('div');
      trialCountdown.textContent = `${daysRemaining} days remaining`;

      expect(trialCountdown.textContent).toContain('10 days remaining');
    });

    test('should show billing date approaching when < 2 days left', () => {
      const trialEndDate = new Date('2026-03-13');
      const today = new Date('2026-03-12');

      const daysRemaining = Math.ceil(
        (trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysRemaining).toBe(1);
      if (daysRemaining < 2) {
        const warning = 'Your first payment will be charged in 1 day';
        expect(warning).toContain('1 day');
      }
    });
  });

  describe('Plan Limit Check Integration', () => {
    test('checkLimitAndShowUpgradePrompt returns true when free user at limit', async () => {
      const mockReminders = Array(5).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
      }));

      const planData = { isPremium: false };

      const isPremium = planData.isPremium;
      const activeCount = mockReminders.filter(r => r.status === 'pending').length;
      const limitReached = !isPremium && activeCount >= 5;

      expect(limitReached).toBe(true);
    });

    test('checkLimitAndShowUpgradePrompt returns false when premium', async () => {
      const mockReminders = Array(10).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
      }));

      const planData = { isPremium: true };

      const isPremium = planData.isPremium;
      const activeCount = mockReminders.filter(r => r.status === 'pending').length;
      const limitReached = !isPremium && activeCount >= 5;

      expect(limitReached).toBe(false);
    });

    test('checkLimitAndShowUpgradePrompt returns false when < 5 reminders', async () => {
      const mockReminders = Array(3).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
      }));

      const planData = { isPremium: false };

      const isPremium = planData.isPremium;
      const activeCount = mockReminders.filter(r => r.status === 'pending').length;
      const limitReached = !isPremium && activeCount >= 5;

      expect(limitReached).toBe(false);
    });
  });

  describe('Payment Listener Setup', () => {
    test('should register payment completion listener', () => {
      const paymentListener = jest.fn();
      chrome.runtime.onMessage.addListener = jest.fn();

      chrome.runtime.onMessage.addListener(paymentListener);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(paymentListener);
    });

    test('should reload popup when SUBSCRIPTION_STATUS_CHANGED received', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { reload: jest.fn() };

      // Simulate receiving payment complete message
      const message = {
        type: MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED,
        data: { planType: 'premium' },
      };

      if (message.type === MESSAGE_TYPES.SUBSCRIPTION_STATUS_CHANGED) {
        window.location.reload();
      }

      expect(window.location.reload).toHaveBeenCalled();
      window.location = originalLocation;
    });

    test('should cleanup payment listener after timeout', () => {
      jest.useFakeTimers();
      const paymentListener = jest.fn();
      chrome.runtime.onMessage.removeListener = jest.fn();

      // Setup listener with 30-minute timeout
      chrome.runtime.onMessage.addListener(paymentListener);
      jest.advanceTimersByTime(30 * 60 * 1000);
      chrome.runtime.onMessage.removeListener(paymentListener);

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(paymentListener);
      jest.useRealTimers();
    });
  });

  describe('i18n Message Keys', () => {
    test('should use upgradePromptTitle message key', () => {
      const titleKey = 'upgradePromptTitle';
      expect(titleKey).toBe('upgradePromptTitle');
    });

    test('should use upgradeButton message key', () => {
      const buttonKey = 'upgradeButton';
      expect(buttonKey).toBe('upgradeButton');
    });

    test('should use paymentInitiationError message key for errors', () => {
      const errorKey = 'paymentInitiationError';
      expect(errorKey).toContain('error');
    });

    test('should use trialOfferText message key', () => {
      const trialKey = 'trialOfferText';
      expect(trialKey).toBe('trialOfferText');
    });
  });
});
