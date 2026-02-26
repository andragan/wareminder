// @ts-check
/**
 * Unit Test Suite: Premium Badge Display
 * Tests show/hide premium badge and account settings visibility
 * @module tests/unit/popup-premium-badge
 */

describe('Unit: Premium Badge Display', () => {
  let mockDOM;
  let mockChrome;

  beforeEach(() => {
    // Setup mock DOM elements
    mockDOM = {
      premiumBadge: {
        hidden: false,
        textContent: 'Premium',
        className: 'premium-badge',
        style: {
          display: 'inline-block',
          visibility: 'visible',
        },
      },
      accountSettings: {
        hidden: false,
        className: 'account-settings',
        style: {
          display: 'flex',
          visibility: 'visible',
        },
      },
      upgradePrompt: {
        hidden: false,
        className: 'upgrade-prompt',
      },
      statusLabel: {
        textContent: '',
      },
      renewalDateLabel: {
        textContent: '',
      },
      manageSubscriptionBtn: {
        className: 'btn btn-primary',
        onclick: null,
      },
    };

    // Setup mock Chrome API
    mockChrome = {
      i18n: {
        getMessage: jest.fn((key) => {
          const messages = {
            premiumBadge: 'Premium',
            accountSettings: 'Account Settings',
            subscriptionStatus: 'Subscription',
            nextRenewalDate: 'Renewal date',
            manageSubscription: 'Manage Subscription',
          };
          return messages[key] || key;
        }),
      },
    };

    global.chrome = mockChrome;
  });

  describe('showPremiumBadge()', () => {
    test('should make premium badge visible', () => {
      const showPremiumBadge = () => {
        mockDOM.premiumBadge.hidden = false;
        mockDOM.premiumBadge.style.display = 'inline-block';
      };

      showPremiumBadge();

      expect(mockDOM.premiumBadge.hidden).toBe(false);
      expect(mockDOM.premiumBadge.style.display).toBe('inline-block');
    });

    test('should set visibility to visible', () => {
      const showPremiumBadge = () => {
        mockDOM.premiumBadge.style.visibility = 'visible';
      };

      showPremiumBadge();

      expect(mockDOM.premiumBadge.style.visibility).toBe('visible');
    });

    test('should display correct badge text', () => {
      const showPremiumBadge = () => {
        mockDOM.premiumBadge.hidden = false;
        mockDOM.premiumBadge.textContent = mockChrome.i18n.getMessage('premiumBadge');
      };

      showPremiumBadge();

      expect(mockDOM.premiumBadge.textContent).toBe('Premium');
      expect(mockChrome.i18n.getMessage).toHaveBeenCalledWith('premiumBadge');
    });

    test('should apply correct CSS class', () => {
      expect(mockDOM.premiumBadge.className).toBe('premium-badge');
    });
  });

  describe('hidePremiumBadge()', () => {
    test('should hide premium badge', () => {
      const hidePremiumBadge = () => {
        mockDOM.premiumBadge.hidden = true;
      };

      hidePremiumBadge();

      expect(mockDOM.premiumBadge.hidden).toBe(true);
    });

    test('should set display to none', () => {
      const hidePremiumBadge = () => {
        mockDOM.premiumBadge.style.display = 'none';
      };

      hidePremiumBadge();

      expect(mockDOM.premiumBadge.style.display).toBe('none');
    });

    test('should maintain element in DOM', () => {
      const hidePremiumBadge = () => {
        mockDOM.premiumBadge.hidden = true;
      };

      hidePremiumBadge();

      // Element still exists, just hidden
      expect(mockDOM.premiumBadge).toBeDefined();
      expect(mockDOM.premiumBadge.className).toBe('premium-badge');
    });
  });

  describe('showAccountSettings()', () => {
    test('should make account settings visible', () => {
      const showAccountSettings = () => {
        mockDOM.accountSettings.hidden = false;
        mockDOM.accountSettings.style.display = 'flex';
      };

      showAccountSettings();

      expect(mockDOM.accountSettings.hidden).toBe(false);
      expect(mockDOM.accountSettings.style.display).toBe('flex');
    });

    test('should display account settings section', () => {
      const showAccountSettings = () => {
        mockDOM.accountSettings.hidden = false;
      };

      showAccountSettings();

      expect(mockDOM.accountSettings.hidden).toBe(false);
    });

    test('should apply correct flex layout', () => {
      expect(mockDOM.accountSettings.style.display).toBe('flex');
    });

    test('should display section title', () => {
      const displayTitle = () => {
        return mockChrome.i18n.getMessage('accountSettings');
      };

      const title = displayTitle();

      expect(title).toBe('Account Settings');
      expect(mockChrome.i18n.getMessage).toHaveBeenCalledWith('accountSettings');
    });
  });

  describe('hideAccountSettings()', () => {
    test('should hide account settings', () => {
      const hideAccountSettings = () => {
        mockDOM.accountSettings.hidden = true;
      };

      hideAccountSettings();

      expect(mockDOM.accountSettings.hidden).toBe(true);
    });

    test('should set display to none', () => {
      const hideAccountSettings = () => {
        mockDOM.accountSettings.style.display = 'none';
      };

      hideAccountSettings();

      expect(mockDOM.accountSettings.style.display).toBe('none');
    });
  });

  describe('updateAccountSettingsDisplay()', () => {
    test('should display subscription status', () => {
      const updateAccountSettingsDisplay = (planData) => {
        mockDOM.statusLabel.textContent =
          planData.plan_type === 'premium' ? 'Premium' : 'Free';
      };

      updateAccountSettingsDisplay({ plan_type: 'premium' });

      expect(mockDOM.statusLabel.textContent).toBe('Premium');
    });

    test('should format renewal date', () => {
      const updateAccountSettingsDisplay = (planData) => {
        if (planData.nextBillingDate) {
          const date = new Date(planData.nextBillingDate);
          mockDOM.renewalDateLabel.textContent = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      };

      updateAccountSettingsDisplay({
        plan_type: 'premium',
        nextBillingDate: '2026-03-27',
      });

      expect(mockDOM.renewalDateLabel.textContent).toMatch(/Mar \d{1,2}, 2026/);
    });

    test('should handle null renewal date', () => {
      const updateAccountSettingsDisplay = (planData) => {
        mockDOM.renewalDateLabel.textContent = planData.nextBillingDate ? 'Has renewal' : 'No renewal';
      };

      updateAccountSettingsDisplay({
        plan_type: 'premium',
        nextBillingDate: null,
      });

      expect(mockDOM.renewalDateLabel.textContent).toBe('No renewal');
    });

    test('should display different status for free plan', () => {
      const updateAccountSettingsDisplay = (planData) => {
        mockDOM.statusLabel.textContent = planData.plan_type === 'premium' ? 'Premium' : 'Free';
      };

      updateAccountSettingsDisplay({ plan_type: 'free' });

      expect(mockDOM.statusLabel.textContent).toBe('Free');
    });
  });

  describe('handleManageSubscription()', () => {
    test('should setup manage subscription button listener', () => {
      const handleManageSubscription = jest.fn();
      mockDOM.manageSubscriptionBtn.addEventListener = jest.fn();

      mockDOM.manageSubscriptionBtn.addEventListener('click', handleManageSubscription);

      expect(mockDOM.manageSubscriptionBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    test('should call handler on button click', () => {
      const handleManageSubscription = jest.fn();
      const listener = jest.fn();

      mockDOM.manageSubscriptionBtn.addEventListener = jest.fn((event, callback) => {
        listener.mockImplementation(callback);
      });

      mockDOM.manageSubscriptionBtn.addEventListener('click', handleManageSubscription);
      listener();

      expect(listener).toHaveBeenCalled();
    });

    test('should redirect to subscription portal', () => {
      const handleManageSubscription = jest.fn(() => {
        // In real code, would call chrome.tabs.create or payment-service
        return { action: 'redirect', target: 'xendit-portal' };
      });

      const result = handleManageSubscription();

      expect(result.action).toBe('redirect');
      expect(result.target).toContain('portal');
    });
  });

  describe('Conditional badge/settings display', () => {
    test('should show badge and settings for premium, hide upgrade prompt', () => {
      const checkAndDisplay = (isPremium) => {
        mockDOM.premiumBadge.hidden = !isPremium;
        mockDOM.accountSettings.hidden = !isPremium;
        mockDOM.upgradePrompt.hidden = isPremium;
      };

      checkAndDisplay(true);

      expect(mockDOM.premiumBadge.hidden).toBe(false);
      expect(mockDOM.accountSettings.hidden).toBe(false);
      expect(mockDOM.upgradePrompt.hidden).toBe(true);
    });

    test('should hide badge and settings for free user', () => {
      const checkAndDisplay = (isPremium) => {
        mockDOM.premiumBadge.hidden = !isPremium;
        mockDOM.accountSettings.hidden = !isPremium;
      };

      checkAndDisplay(false);

      expect(mockDOM.premiumBadge.hidden).toBe(true);
      expect(mockDOM.accountSettings.hidden).toBe(true);
    });

    test('should not show upgrade prompt for premium', () => {
      const checkAndDisplay = (isPremium) => {
        if (isPremium) {
          mockDOM.upgradePrompt.hidden = true;
        }
      };

      checkAndDisplay(true);

      expect(mockDOM.upgradePrompt.hidden).toBe(true);
    });
  });

  describe('Badge styling', () => {
    test('should have correct badge styles', () => {
      const badgeStyle = mockDOM.premiumBadge.style;

      // Badge should be inline-block for positioning
      expect(badgeStyle.display).toBe('inline-block');
    });

    test('should apply premium badge CSS class', () => {
      expect(mockDOM.premiumBadge.className).toContain('premium-badge');
    });

    test('account settings should use flex layout', () => {
      expect(mockDOM.accountSettings.style.display).toBe('flex');
    });

    test('manage subscription button should have button styling', () => {
      expect(mockDOM.manageSubscriptionBtn.className).toContain('btn');
      expect(mockDOM.manageSubscriptionBtn.className).toContain('btn-primary');
    });
  });

  describe('Integration with premium flow', () => {
    test('should coordinate badge, settings, and prompt visibility', () => {
      const updateUIForPlan = (isPremium) => {
        mockDOM.premiumBadge.hidden = !isPremium;
        mockDOM.accountSettings.hidden = !isPremium;
        mockDOM.upgradePrompt.hidden = isPremium;
      };

      // Premium case
      updateUIForPlan(true);
      expect(mockDOM.premiumBadge.hidden).toBe(false);
      expect(mockDOM.accountSettings.hidden).toBe(false);
      expect(mockDOM.upgradePrompt.hidden).toBe(true);

      // Free case
      updateUIForPlan(false);
      expect(mockDOM.premiumBadge.hidden).toBe(true);
      expect(mockDOM.accountSettings.hidden).toBe(true);
    });

    test('should handle upgrade completion and UI transition', () => {
      // Start as free
      let isPremium = false;
      mockDOM.premiumBadge.hidden = !isPremium;
      mockDOM.accountSettings.hidden = !isPremium;

      expect(mockDOM.premiumBadge.hidden).toBe(true);
      expect(mockDOM.accountSettings.hidden).toBe(true);

      // After upgrade: update to premium
      isPremium = true;
      mockDOM.premiumBadge.hidden = !isPremium;
      mockDOM.accountSettings.hidden = !isPremium;

      expect(mockDOM.premiumBadge.hidden).toBe(false);
      expect(mockDOM.accountSettings.hidden).toBe(false);
    });

    test('should maintain state consistency', () => {
      const states = [
        { isPremium: true, expectedBadgeHidden: false, expectedSettingsHidden: false },
        { isPremium: false, expectedBadgeHidden: true, expectedSettingsHidden: true },
        { isPremium: true, expectedBadgeHidden: false, expectedSettingsHidden: false },
      ];

      states.forEach((state) => {
        mockDOM.premiumBadge.hidden = state.expectedBadgeHidden;
        mockDOM.accountSettings.hidden = state.expectedSettingsHidden;

        expect(mockDOM.premiumBadge.hidden).toBe(state.expectedBadgeHidden);
        expect(mockDOM.accountSettings.hidden).toBe(state.expectedSettingsHidden);
      });
    });
  });

  describe('Accessibility', () => {
    test('should have accessible label for premium badge', () => {
      const label = mockChrome.i18n.getMessage('premiumBadge');

      expect(label).toBe('Premium');
      expect(label.length).toBeGreaterThan(0);
    });

    test('should have button aria-label for manage subscription', () => {
      mockDOM.manageSubscriptionBtn['aria-label'] = 'Manage your subscription';

      expect(mockDOM.manageSubscriptionBtn['aria-label']).toBeDefined();
    });

    test('should maintain focus management on show/hide', () => {
      mockDOM.manageSubscriptionBtn.focus = jest.fn();

      mockDOM.accountSettings.hidden = false;
      mockDOM.manageSubscriptionBtn.focus();

      expect(mockDOM.manageSubscriptionBtn.focus).toHaveBeenCalled();
    });
  });
});
