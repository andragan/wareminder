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
   * Extracts the current chat context from WhatsApp Web DOM.
   * Gets chatId from sidebar selected item's data-id attribute,
   * and chatName from the header text.
   * @returns {{ chatId: string, chatName: string } | null}
   */
  function extractChatContext() {
    try {
      // Extract chat name from header
      const header = document.querySelector('#main header');
      if (!header) return null;

      // The contact name is typically in a span with a title attribute within the header
      const nameEl = header.querySelector('span[title]');
      const chatName = nameEl ? nameEl.getAttribute('title') : null;
      if (!chatName || !chatName.trim()) return null;

      // Extract chat ID from sidebar selected chat's data-id attribute
      let chatId = null;

      // Method 1: Look for selected/focused chat list item with data-id
      const selectedChat = document.querySelector(
        '[aria-selected="true"] [data-id]'
      );
      if (selectedChat) {
        chatId = selectedChat.getAttribute('data-id');
      }

      // Method 2: Look for the active/focused row in the chat list
      if (!chatId) {
        const focusedRow = document.querySelector(
          '#pane-side [tabindex="-1"][data-id]'
        );
        if (focusedRow) {
          chatId = focusedRow.getAttribute('data-id');
        }
      }

      // Method 3: Look for any element with matching data-id in sidebar
      if (!chatId) {
        const allDataIds = document.querySelectorAll('#pane-side [data-id]');
        for (const el of allDataIds) {
          const id = el.getAttribute('data-id');
          if (id && (id.endsWith('@c.us') || id.endsWith('@g.us'))) {
            // Try to match by checking if the title in this row matches our chat name
            const rowTitle = el.querySelector('span[title]');
            if (rowTitle && rowTitle.getAttribute('title') === chatName) {
              chatId = id;
              break;
            }
          }
        }
      }

      if (!chatId) return null;

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
      btn.title = 'Set Reminder';
      btn.setAttribute('aria-label', 'Set Reminder');

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
    errorEl.textContent = 'Could not detect chat. Use the popup dashboard instead.';

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
      console.info('WAReminder: Button injection failed, popup dashboard available as fallback.');
    }
  }

  // Expose on global namespace
  window.WAReminder = window.WAReminder || {};
  window.WAReminder.extractChatContext = extractChatContext;
  window.WAReminder.injectReminderButton = injectReminderButton;
  window.WAReminder.onChatHeaderDetected = onChatHeaderDetected;
})();
