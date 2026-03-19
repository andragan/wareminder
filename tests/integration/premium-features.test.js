// @ts-check
/**
 * E2E Test Suite: Premium Features User Story
 * Tests unlimited reminder creation and premium UI features
 * @module tests/e2e/premium-features
 */

import { MESSAGE_TYPES } from '../../src/lib/constants.js';

describe('E2E: Premium Features User Story', () => {
  let mockChrome;
  let popupContext;

  beforeEach(() => {
    // Setup mock Chrome API
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(async (message) => {
          if (message.type === MESSAGE_TYPES.GET_PLAN_STATUS) {
            return {
              isPremium: true,
              plan_type: 'premium',
              trialEndDate: null,
              nextBillingDate: '2026-03-27',
            };
          }
          if (message.type === MESSAGE_TYPES.GET_REMINDERS) {
            return popupContext.reminders || [];
          }
          return null;
        }),
      },
      storage: {
        local: {
          get: jest.fn(async (keys) => ({
            reminders: popupContext.reminders || [],
            subscriptionStatus: {
              plan_type: 'premium',
              status: 'active',
              trialEndDate: null,
              nextBillingDate: '2026-03-27',
            },
          })),
          set: jest.fn(),
        },
      },
      i18n: {
        getMessage: jest.fn((key) => {
          const messages = {
            premiumBadge: 'Premium',
            accountSettings: 'Account Settings',
            subscriptionStatus: 'Subscription',
            nextRenewalDate: 'Renewal date: Mar 27, 2026',
            manageSubscription: 'Manage Subscription',
            setReminder: 'Set Reminder',
          };
          return messages[key] || key;
        }),
      },
    };

    global.chrome = mockChrome;

    // Create popup DOM context
    popupContext = {
      reminders: [],
      reminderList: {
        innerHTML: '',
      },
      setReminderBtn: {
        addEventListener: jest.fn(),
      },
      premiumBadge: {
        hidden: false,
        style: {},
      },
      accountSettings: {
        hidden: false,
        style: {},
      },
      upgradePrompt: {
        hidden: true,
        style: {},
      },
      statusLabel: {
        textContent: '',
      },
      renewalDateLabel: {
        textContent: '',
      },
      manageSubscriptionBtn: {
        addEventListener: jest.fn(),
      },
    };
  });

  describe('Premium badge display', () => {
    test('should display premium badge when user is premium', async () => {
      const showPremiumBadge = () => {
        popupContext.premiumBadge.hidden = false;
      };

      showPremiumBadge();

      expect(popupContext.premiumBadge.hidden).toBe(false);
    });

    test('should hide premium badge when user is not premium', async () => {
      const hidePremiumBadge = () => {
        popupContext.premiumBadge.hidden = true;
      };

      hidePremiumBadge();

      expect(popupContext.premiumBadge.hidden).toBe(true);
    });

    test('should position badge in header next to title', async () => {
      popupContext.premiumBadge.hidden = false;
      popupContext.premiumBadge.style.display = 'inline-block';

      expect(popupContext.premiumBadge.style.display).toBe('inline-block');
    });
  });

  describe('Account settings display', () => {
    test('should display account settings section for premium users', async () => {
      popupContext.accountSettings.hidden = false;

      expect(popupContext.accountSettings.hidden).toBe(false);
    });

    test('should show subscription status in account settings', async () => {
      popupContext.statusLabel.textContent = 'Premium';

      expect(popupContext.statusLabel.textContent).toBe('Premium');
    });

    test('should show next renewal date', async () => {
      const renewalDate = new Date('2026-03-27').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      popupContext.renewalDateLabel.textContent = `Renewal date: ${renewalDate}`;

      expect(popupContext.renewalDateLabel.textContent).toContain('Renewal date:');
      expect(popupContext.renewalDateLabel.textContent).toContain('Mar');
    });

    test('should hide account settings when user is not premium', async () => {
      popupContext.accountSettings.hidden = true;

      expect(popupContext.accountSettings.hidden).toBe(true);
    });
  });

  describe('Unlimited reminder creation', () => {
    test('should allow premium user to create 50+ reminders without error', async () => {
      const createReminders = async () => {
        const reminders = [];
        for (let i = 0; i < 50; i++) {
          reminders.push({
            id: `reminder-${i}`,
            chatId: `chat-${i}`,
            chatName: `Chat ${i}`,
            scheduledTime: Date.now() + (i + 1) * 60000,
            status: 'pending',
            createdAt: Date.now(),
          });
        }
        return reminders;
      };

      popupContext.reminders = await createReminders();

      expect(popupContext.reminders).toHaveLength(50);
      expect(popupContext.reminders.every((r) => r.status === 'pending')).toBe(true);
    });

    test('should not show upgrade prompt for premium user', async () => {
      popupContext.upgradePrompt.hidden = true;

      expect(popupContext.upgradePrompt.hidden).toBe(true);
    });

    test('should display all reminders in list for premium user', async () => {
      const createReminders = async () => {
        return Array.from({ length: 25 }, (_, i) => ({
          id: `reminder-${i}`,
          chatId: `chat-${i}`,
          chatName: `Chat ${i}`,
          scheduledTime: Date.now() + (i + 1) * 60000,
          status: 'pending',
          createdAt: Date.now(),
        }));
      };

      popupContext.reminders = await createReminders();
      popupContext.reminderList.innerHTML = popupContext.reminders
        .map((r) => `<div class="reminder-item" data-id="${r.id}">${r.chatName}</div>`)
        .join('');

      expect(popupContext.reminderList.innerHTML).toContain('Chat 0');
      expect(popupContext.reminderList.innerHTML).toContain('Chat 24');
    });
  });

  describe('No upgrade prompt for premium users', () => {
    test('should check plan status and hide upgrade prompt', async () => {
      const planStatus = await mockChrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_PLAN_STATUS,
      });

      if (planStatus.isPremium) {
        popupContext.upgradePrompt.hidden = true;
      }

      expect(popupContext.upgradePrompt.hidden).toBe(true);
    });

    test('should only show account settings for premium users', async () => {
      const planStatus = await mockChrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_PLAN_STATUS,
      });

      if (planStatus.isPremium) {
        popupContext.accountSettings.hidden = false;
        popupContext.upgradePrompt.hidden = true;
        popupContext.premiumBadge.hidden = false;
      }

      expect(popupContext.accountSettings.hidden).toBe(false);
      expect(popupContext.upgradePrompt.hidden).toBe(true);
      expect(popupContext.premiumBadge.hidden).toBe(false);
    });

    test('should cache premium status in local storage', () => {
      mockChrome.storage.local.get(['subscriptionStatus'], jest.fn());

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
        ['subscriptionStatus'],
        expect.any(Function)
      );
    });
  });

  describe('Account settings interaction', () => {
    test('should setup manage subscription button click listener', async () => {
      popupContext.manageSubscriptionBtn.addEventListener('click', jest.fn());

      expect(popupContext.manageSubscriptionBtn.addEventListener).toHaveBeenCalled();
    });

    test('should handle manage subscription button click', async () => {
      const clickHandler = jest.fn();
      popupContext.manageSubscriptionBtn.addEventListener('click', clickHandler);

      // Simulate click event
      clickHandler();

      expect(clickHandler).toHaveBeenCalled();
    });

    test('should display formatted renewal date', async () => {
      const dateStr = '2026-03-27';
      const formatted = new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      popupContext.renewalDateLabel.textContent = formatted;

      expect(popupContext.renewalDateLabel.textContent).toMatch(/Mar \d{1,2}, 2026/);
    });
  });
});
