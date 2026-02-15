// @ts-check

/**
 * DOM injection for the "Set Reminder" button into WhatsApp Web chat header.
 * Also handles chat context extraction (chatId, chatName).
 * @module injector
 */

(function () {
  'use strict';

  const REMINDER_BTN_TESTID = 'wa-reminder-btn';
  const REMINDER_BTN_SELECTOR = `[data-testid="${REMINDER_BTN_TESTID}"]`;

  /**
   * Extracts the current chat context from WhatsApp Web DOM and URL.
   * Uses header title for chatName and attempts to extract chatId from URL or DOM.
   * @returns {{ chatId: string, chatName: string } | null}
   */
  function extractChatContext() {
    try {
      // Extract chat name from header
      const header = document.querySelector('#main header');
      if (!header) {
        console.warn('WAReminder: Header not found');
        return null;
      }

      // Look for the contact/group name in the header
      // It's in a span with title attribute and dir="auto"
      const nameEl = header.querySelector('span[dir="auto"]');
      const chatName = nameEl ? nameEl.textContent : null;
      
      if (!chatName || !chatName.trim()) {
        console.warn('WAReminder: Chat name not found in header');
        return null;
      }

      let chatId = null;

      // Try to extract chatId from the current URL
      // WhatsApp Web URLs contain phone numbers or group IDs
      const urlParams = new URLSearchParams(window.location.search);
      
      // For individual chats: ?phone=XXXXXXXXXX
      const phoneParam = urlParams.get('phone');
      if (phoneParam) {
        // Format as WhatsApp ID: phone@c.us
        chatId = `${phoneParam}@c.us`;
      }
      
      // For group chats: typically no phone param, fall back to chat name
      // As fallback identifier for groups (will be stored locally)
      if (!chatId) {
        const chatNameId = chatName.toLowerCase().replace(/\s+/g, '_');
        // Create a deterministic ID if we can't find the real one
        // This allows local reminders to work even if we can't get the phone
        chatId = chatNameId;
      }

      return {
        chatId: chatId.trim(),
        chatName: chatName.trim(),
      };
    } catch (e) {
      console.warn('WAReminder: Failed to extract chat context', e);
      return null;
    }
  }

  /**
   * Injects the "Set Reminder" button into the chat header action buttons area.
   * @param {Element} header - The #main header element
   * @returns {boolean} Whether injection succeeded
   */
  function injectReminderButton(header) {
    // Don't inject if already present
    if (header.querySelector(REMINDER_BTN_SELECTOR)) {
      return true;
    }

    try {
      // Find the action buttons container (right side of header)
      // WhatsApp Web uses divs with role="button" for action buttons
      const actionButtons = header.querySelectorAll('[role="button"]');
      if (actionButtons.length === 0) {
        // Try alternative: find the last div container in the header
        // which typically holds the action buttons
        const headerChildren = header.children;
        if (headerChildren.length === 0) return false;
      }

      // Create the reminder button
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', REMINDER_BTN_TESTID);
      btn.className = 'wa-reminder-btn';
      btn.type = 'button';
      btn.title = (chrome.i18n && chrome.i18n.getMessage('setReminder')) || 'Set Reminder';
      btn.setAttribute('aria-label', (chrome.i18n && chrome.i18n.getMessage('setReminder')) || 'Set Reminder');

      // Bell icon SVG
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" class="wa-reminder-icon">
          <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
      `;

      // Click handler: show reminder prompt
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const context = extractChatContext();
        if (!context) {
          showInjectionError(header);
          return;
        }

        if (typeof WAReminder !== 'undefined' && WAReminder.showPrompt) {
          WAReminder.showPrompt(context, header);
        }
      });

      // Find where to insert the button
      // Insert before the last action button group (typically the kebab menu)
      const lastActionBtn = actionButtons.length > 0
        ? actionButtons[actionButtons.length - 1]
        : null;

      if (lastActionBtn && lastActionBtn.parentElement) {
        // Insert as a sibling in the same container
        const container = lastActionBtn.closest('div') || lastActionBtn.parentElement;
        container.insertBefore(btn, lastActionBtn);
      } else {
        // Fallback: append to header
        const headerRight = header.lastElementChild;
        if (headerRight) {
          headerRight.appendChild(btn);
        } else {
          header.appendChild(btn);
        }
      }

      return true;
    } catch (e) {
      console.warn('WAReminder: Failed to inject button', e);
      return false;
    }
  }

  /**
   * Shows an error notification when injection fails, guiding user to popup.
   * @param {Element} header
   */
  function showInjectionError(header) {
    // Create a temporary inline error message
    const existing = header.querySelector('.wa-reminder-error');
    if (existing) existing.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'wa-reminder-error';
    errorEl.textContent = (chrome.i18n && chrome.i18n.getMessage('injectionFailed')) || 'Could not detect chat. Use the popup dashboard instead.';

    header.appendChild(errorEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorEl.parentElement) {
        errorEl.remove();
      }
    }, 5000);
  }

  /**
   * Called by chat-observer when a chat header is detected.
   * Attempts to inject the reminder button.
   * @param {Element} header
   */
  function onChatHeaderDetected(header) {
    const success = injectReminderButton(header);
    if (!success) {
      console.warn('WAReminder: Button injection failed, popup dashboard available as fallback.');
      showInjectionError(header);
    }
  }

  // Expose on global namespace
  window.WAReminder = window.WAReminder || {};
  window.WAReminder.extractChatContext = extractChatContext;
  window.WAReminder.injectReminderButton = injectReminderButton;
  window.WAReminder.onChatHeaderDetected = onChatHeaderDetected;
})();
