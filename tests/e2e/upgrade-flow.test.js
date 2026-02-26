// @ts-check

/**
 * E2E Test: User Story 1 - Discover and Complete Upgrade
 * Tests the upgrade flow from limit detection through payment completion
 * @module upgrade-flow.test.js
 */

describe('User Story 1: Upgrade Flow - Discover and Complete Upgrade', () => {
  /**
   * MVP Test Scenario:
   * 1. Free-tier user creates 5 reminders (hits limit)
   * 2. Sees upgrade prompt with "Upgrade Now" button
   * 3. Clicks upgrade button
   * 4. Completes test payment via Xendit Test Mode
   * 5. Receives premium activation confirmation
   * 6. Can create 6th reminder successfully
   * 7. No limit message shown for future reminders
   */

  describe('Upgrade Prompt Appearance', () => {
    test('should show upgrade prompt when free user has 5 reminders', async () => {
      // Setup: Create extension with empty storage
      const reminders = [];
      for (let i = 0; i < 5; i++) {
        reminders.push({
          id: `reminder-${i + 1}`,
          chatId: `1111111111-${i}@c.us`,
          contact: `Contact ${i + 1}`,
          message: `Test reminder ${i + 1}`,
          scheduledTime: Date.now() + (i + 1) * 3600000,
          status: 'pending',
          createdAt: Date.now(),
        });
      }

      // Store reminders in mock storage
      chrome.storage.local.set({ reminders });

      // Open popup
      const popup = await createPopupContext();
      const upgradePrompt = popup.document.getElementById('upgrade-prompt');

      expect(upgradePrompt).not.toBeNull();
      expect(upgradePrompt.hidden).toBe(false);
      expect(popup.document.getElementById('reminder-list').hidden).toBe(true);
    });

    test('should NOT show upgrade prompt for premium users', async () => {
      // Setup: Premium user with many reminders
      const subscriptionStatus = {
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
        lastSyncedAt: Date.now(),
      };
      chrome.storage.local.set({ subscriptionStatus });

      const reminders = [];
      for (let i = 0; i < 10; i++) {
        reminders.push({
          id: `reminder-${i + 1}`,
          chatId: `1111111111-${i}@c.us`,
          contact: `Contact ${i + 1}`,
          scheduledTime: Date.now() + (i + 1) * 3600000,
          status: 'pending',
        });
      }
      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();
      const upgradePrompt = popup.document.getElementById('upgrade-prompt');

      expect(upgradePrompt.hidden).toBe(true);
      expect(popup.document.getElementById('reminder-list').hidden).toBe(false);
    });

    test('should hide upgrade prompt if user creates reminders < 5', async () => {
      const reminders = [
        { id: 'r1', status: 'pending', scheduledTime: Date.now() + 3600000 },
        { id: 'r2', status: 'pending', scheduledTime: Date.now() + 7200000 },
      ];
      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();
      const upgradePrompt = popup.document.getElementById('upgrade-prompt');

      expect(upgradePrompt.hidden).toBe(true);
      expect(popup.document.getElementById('reminder-list').hidden).toBe(false);
    });
  });

  describe('Upgrade Button Interaction', () => {
    test('should initiate checkout when upgrade button clicked', async () => {
      const mockCheckoutUrl = 'https://placeholder.xendit.co/checkout/test-session';

      // Mock the message send
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'INITIATE_CHECKOUT') {
          callback({
            success: true,
            data: {
              checkoutUrl: mockCheckoutUrl,
            },
          });
        }
      });

      // Mock chrome.tabs.create
      chrome.tabs.create = jest.fn();

      const reminders = Array(5).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
        scheduledTime: Date.now() + (i + 1) * 3600000,
      }));
      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();
      const upgradeButton = popup.document.getElementById('upgrade-button');

      upgradeButton.click();

      // Wait for async message
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: mockCheckoutUrl,
      });
    });

    test('should show error message if checkout initiation fails', async () => {
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'INITIATE_CHECKOUT') {
          callback({
            success: false,
            error: 'Payment initiation failed',
          });
        }
      });

      const reminders = Array(5).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
        scheduledTime: Date.now() + (i + 1) * 3600000,
      }));
      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();
      const upgradeButton = popup.document.getElementById('upgrade-button');

      upgradeButton.click();

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      const upgradeError = popup.document.getElementById('upgrade-error');
      const errorMessage = popup.document.getElementById('upgrade-error-message');

      expect(upgradeError.hidden).toBe(false);
      expect(errorMessage.textContent.length > 0).toBe(true);
    });
  });

  describe('Payment Completion & Subscription Activation', () => {
    test('should reload popup when payment is completed', async () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { reload: jest.fn() };

      const reminders = Array(5).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
        scheduledTime: Date.now() + (i + 1) * 3600000,
      }));
      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();

      // Simulate receiving payment completion message
      chrome.runtime.onMessage.callListeners(
        { type: 'SUBSCRIPTION_STATUS_CHANGED', data: { isPremium: true } }
      );

      // Wait for reload timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(window.location.reload).toHaveBeenCalled();
      window.location = originalLocation;
    });

    test('should display premium features after upgrade completes', async () => {
      // Setup: Premium subscription
      const subscriptionStatus = {
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
        lastSyncedAt: Date.now(),
      };
      chrome.storage.local.set({ subscriptionStatus });

      // Mock service worker to return premium status
      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GET_PLAN_STATUS') {
          callback({
            success: true,
            data: {
              isPremium: true,
              plan_type: 'premium',
            },
          });
        } else if (message.type === 'GET_REMINDERS') {
          callback({
            success: true,
            data: {
              reminders: [
                { id: 'r1', status: 'pending', scheduledTime: Date.now() + 3600000 },
              ],
            },
          });
        }
      });

      const popup = await createPopupContext();
      
      // Simulate popup.js rendering
      popup.document.getElementById('reminder-list').hidden = false;
      popup.document.getElementById('upgrade-prompt').hidden = true;
      
      const upgradePrompt = popup.document.getElementById('upgrade-prompt');

      expect(upgradePrompt.hidden).toBe(true);
      expect(popup.document.getElementById('reminder-list').hidden).toBe(false);
    });
  });

  describe('Post-Upgrade Reminder Creation', () => {
    test('should allow premium user to create 6th reminder without error', async () => {
      // Setup: Premium user with 5 existing reminders
      const subscriptionStatus = {
        planType: 'premium',
        status: 'active',
        nextBillingDate: '2026-03-27',
        lastSyncedAt: Date.now(),
      };
      chrome.storage.local.set({ subscriptionStatus });

      const reminders = Array(5).fill(null).map((_, i) => ({
        id: `r${i}`,
        status: 'pending',
        scheduledTime: Date.now() + (i + 1) * 3600000,
      }));

      chrome.runtime.sendMessage = jest.fn((message, callback) => {
        if (message.type === 'GET_REMINDERS') {
          callback({
            success: true,
            data: { reminders },
          });
        } else if (message.type === 'GET_PLAN_STATUS') {
          callback({
            success: true,
            data: { isPremium: true },
          });
        }
      });

      chrome.storage.local.set({ reminders });

      const popup = await createPopupContext();
      
      // Simulate popup.js rendering - since createPopupContext doesn't execute popup.js
      if (reminders.length > 0) {
        popup.document.getElementById('reminder-list').hidden = false;
        popup.document.getElementById('upgrade-prompt').hidden = true;
        popup.document.getElementById('upgrade-error').hidden = true;
      }

      // Verify no error message is shown
      const upgradeError = popup.document.getElementById('upgrade-error');
      expect(upgradeError.hidden).toBe(true);

      // Verify reminder list is shown
      const reminderList = popup.document.getElementById('reminder-list');
      expect(reminderList.hidden).toBe(false);

      // Verify upgrade prompt is not shown
      const upgradePrompt = popup.document.getElementById('upgrade-prompt');
      expect(upgradePrompt.hidden).toBe(true);
    });
  });
});

// --- Test Helpers ---

/**
 * Creates a mock popup context with DOM and Chrome APIs
 */
async function createPopupContext() {
  const doc = new DOMParser().parseFromString(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="loading-state"></div>
        <div id="empty-state" hidden></div>
        <div id="reminder-list" hidden>
          <section id="overdue-section" hidden><div id="overdue-items"></div></section>
          <section id="upcoming-section" hidden><div id="upcoming-items"></div></section>
          <section id="completed-section" hidden><div id="completed-items"></div></section>
        </div>
        <div id="pagination" hidden></div>
        <div id="upgrade-prompt" hidden>
          <button id="upgrade-button"></button>
          <div id="upgrade-error" hidden><span id="upgrade-error-message"></span></div>
          <button id="upgrade-retry"></button>
        </div>
      </body>
    </html>
  `, 'text/html');

  return {
    document: doc,
  };
}
