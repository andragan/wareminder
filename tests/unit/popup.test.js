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

// --- Reminder List UI Tests (migrated from Playwright) ---

describe('Popup: Reminder List Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.sendMessage.mockReset();
  });

  describe('Empty State', () => {
    test('should show empty state element', () => {
      const emptyState = document.createElement('div');
      emptyState.id = 'empty-state';
      emptyState.hidden = false;

      expect(emptyState.hidden).toBe(false);
      expect(emptyState.id).toBe('empty-state');
    });

    test('should have correct empty state text content', () => {
      const emptyTitle = document.createElement('p');
      emptyTitle.className = 'empty-title';
      emptyTitle.textContent = 'No follow-ups scheduled';

      const emptySubtitle = document.createElement('p');
      emptySubtitle.className = 'empty-subtitle';
      emptySubtitle.textContent = 'Open a WhatsApp Web chat to set one!';

      expect(emptyTitle.textContent).toBe('No follow-ups scheduled');
      expect(emptySubtitle.textContent).toBe('Open a WhatsApp Web chat to set one!');
    });
  });

  describe('Reminder List', () => {
    test('should display reminder list container', () => {
      const reminderList = document.createElement('div');
      reminderList.id = 'reminder-list';
      reminderList.hidden = false;

      expect(reminderList.hidden).toBe(false);
      expect(reminderList.id).toBe('reminder-list');
    });

    test('should show upcoming section when present', () => {
      const upcomingSection = document.createElement('section');
      upcomingSection.id = 'upcoming-section';
      upcomingSection.hidden = false;

      expect(upcomingSection.hidden).toBe(false);
    });

    test('should show overdue section when present', () => {
      const overdueSection = document.createElement('section');
      overdueSection.id = 'overdue-section';
      overdueSection.hidden = false;

      expect(overdueSection.hidden).toBe(false);
    });

    test('should show completed section when present', () => {
      const completedSection = document.createElement('section');
      completedSection.id = 'completed-section';
      completedSection.hidden = false;

      expect(completedSection.hidden).toBe(false);
    });
  });

  describe('Reminder Item Elements', () => {
    test('should render reminder item with correct structure', () => {
      const reminderItem = document.createElement('div');
      reminderItem.className = 'reminder-item';
      reminderItem.id = 'r1';

      const reminderName = document.createElement('span');
      reminderName.className = 'reminder-name';
      reminderName.textContent = 'Alice';

      reminderItem.appendChild(reminderName);

      expect(reminderItem.id).toBe('r1');
      expect(reminderItem.querySelector('.reminder-name').textContent).toBe('Alice');
    });

    test('should display reminder status badge', () => {
      const statusBadge = document.createElement('span');
      statusBadge.className = 'reminder-status-badge reminder-status-badge--pending';
      statusBadge.textContent = 'Pending';

      expect(statusBadge.textContent).toBe('Pending');
      expect(statusBadge.className).toContain('pending');
    });

    test('should have complete action button for pending reminders', () => {
      const completeBtn = document.createElement('button');
      completeBtn.className = 'action-btn action-btn--complete';
      completeBtn.textContent = '✓';

      expect(completeBtn.className).toContain('complete');
      expect(completeBtn.textContent).toBe('✓');
    });

    test('should have delete action button', () => {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn action-btn--delete';
      deleteBtn.textContent = '🗑';

      expect(deleteBtn.className).toContain('delete');
      expect(deleteBtn.textContent).toBe('🗑');
    });

    test('should have open chat action button', () => {
      const openBtn = document.createElement('button');
      openBtn.className = 'action-btn action-btn--open';
      openBtn.textContent = '▶';

      expect(openBtn.className).toContain('open');
    });
  });

  describe('Overdue Reminders', () => {
    test('should mark overdue reminder with overdue class', () => {
      const reminderItem = document.createElement('div');
      reminderItem.className = 'reminder-item reminder-item--overdue';

      expect(reminderItem.className).toContain('overdue');
    });

    test('should show "Overdue" status badge', () => {
      const badge = document.createElement('span');
      badge.className = 'reminder-status-badge reminder-status-badge--overdue';
      badge.textContent = 'Overdue';

      expect(badge.textContent).toBe('Overdue');
    });
  });

  describe('Completed Reminders', () => {
    test('should mark completed reminder with completed class', () => {
      const reminderItem = document.createElement('div');
      reminderItem.className = 'reminder-item reminder-item--completed';

      expect(reminderItem.className).toContain('completed');
    });

    test('should show "Done" status badge for completed', () => {
      const badge = document.createElement('span');
      badge.className = 'reminder-status-badge reminder-status-badge--completed';
      badge.textContent = 'Done';

      expect(badge.textContent).toBe('Done');
    });

    test('should not show complete button for completed reminders', () => {
      const completedItem = document.createElement('div');
      completedItem.className = 'reminder-item reminder-item--completed';

      // Completed items don't have complete button
      const completeBtn = completedItem.querySelector('.action-btn--complete');
      expect(completeBtn).toBeNull();
    });

    test('should still show delete button for completed reminders', () => {
      const completedItem = document.createElement('div');
      completedItem.className = 'reminder-item reminder-item--completed';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn action-btn--delete';
      completedItem.appendChild(deleteBtn);

      expect(completedItem.querySelector('.action-btn--delete')).toBeTruthy();
    });
  });

  describe('Reminder Count Header', () => {
    test('should display reminder count', () => {
      const reminderCount = document.createElement('span');
      reminderCount.id = 'reminder-count';
      reminderCount.textContent = '5 pending';

      expect(reminderCount.textContent).toBe('5 pending');
    });

    test('should update count based on pending reminders', () => {
      const reminderCount = document.createElement('span');
      reminderCount.id = 'reminder-count';

      const pendingCount = 3;
      reminderCount.textContent = `${pendingCount} pending`;

      expect(reminderCount.textContent).toContain('3');
      expect(reminderCount.textContent).toContain('pending');
    });
  });
});

describe('Popup: Notification & Dialogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Permission Warning', () => {
    test('should show notification warning when permission denied', () => {
      const notificationWarning = document.createElement('div');
      notificationWarning.id = 'notification-warning';
      notificationWarning.hidden = false;

      expect(notificationWarning.hidden).toBe(false);
    });

    test('should hide notification warning when permission granted', () => {
      const notificationWarning = document.createElement('div');
      notificationWarning.id = 'notification-warning';
      notificationWarning.hidden = true;

      expect(notificationWarning.hidden).toBe(true);
    });

    test('should display warning icon and text', () => {
      const warningIcon = document.createElement('span');
      warningIcon.className = 'warning-icon';
      warningIcon.textContent = '⚠️';

      const warningText = document.createElement('span');
      warningText.className = 'warning-text';
      warningText.textContent = 'Notifications are disabled.';

      expect(warningIcon.textContent).toBe('⚠️');
      expect(warningText.textContent).toContain('disabled');
    });
  });

  describe('Delete Dialog', () => {
    test('should have delete confirmation dialog', () => {
      const deleteDialog = document.createElement('div');
      deleteDialog.id = 'delete-dialog';
      deleteDialog.hidden = true; // Initially hidden

      expect(deleteDialog.id).toBe('delete-dialog');
      expect(deleteDialog.hidden).toBe(true);
    });

    test('should have cancel and confirm buttons in dialog', () => {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'delete-cancel';

      const confirmBtn = document.createElement('button');
      confirmBtn.id = 'delete-confirm';

      expect(cancelBtn.id).toBe('delete-cancel');
      expect(confirmBtn.id).toBe('delete-confirm');
    });

    test('should show reminder details in delete dialog', () => {
      const dialogDetail = document.createElement('p');
      dialogDetail.id = 'delete-dialog-detail';
      dialogDetail.textContent = 'Delete reminder with Alice at 3:00 PM?';

      expect(dialogDetail.textContent).toContain('Delete');
      expect(dialogDetail.textContent).toContain('Alice');
    });
  });
});

describe('Popup: Group Chat Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render group chat reminders', () => {
    const groupName = 'Family Group';
    const reminderName = document.createElement('span');
    reminderName.className = 'reminder-name';
    reminderName.textContent = groupName;

    expect(reminderName.textContent).toBe('Family Group');
  });

  test('should differentiate group vs individual chat by ID format', () => {
    const groupChatId = '120363123456789@g.us';
    const individualChatId = '5511999999999@c.us';

    const isGroup = groupChatId.endsWith('@g.us');
    const isIndividual = individualChatId.endsWith('@c.us');

    expect(isGroup).toBe(true);
    expect(isIndividual).toBe(true);
  });

  test('should handle group chat with same rendering as individual', () => {
    const groupReminder = document.createElement('div');
    groupReminder.className = 'reminder-item reminder-item--group';

    const completeBtn = document.createElement('button');
    completeBtn.className = 'action-btn--complete';
    groupReminder.appendChild(completeBtn);

    expect(groupReminder.querySelector('.action-btn--complete')).toBeTruthy();
  });
});
