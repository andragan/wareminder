// @ts-check

/**
 * Time-selection prompt UI for creating reminders.
 * Shows preset options (1 hour, tonight, tomorrow) and custom date/time picker.
 * Each preset resolves and displays the absolute datetime before user confirms.
 * @module reminder-prompt
 */

(function () {
  'use strict';

  /** @type {HTMLElement|null} */
  let currentOverlay = null;

  /**
   * Formats a date for display in the prompt.
   * @param {Date} date
   * @returns {string}
   */
  function formatPromptTime(date) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Calculates the preset time values based on the current time.
   * @returns {Array<{ label: string, time: Date }>}
   */
  function calculatePresets() {
    const now = new Date();
    const presets = [];

    // 1 hour from now
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    presets.push({ label: 'In 1 hour', time: oneHour });

    // Tonight at 8 PM
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() <= now.getTime()) {
      // If past 8 PM, set to tomorrow at 8 PM
      tonight.setDate(tonight.getDate() + 1);
    }
    presets.push({ label: 'Tonight at 8 PM', time: tonight });

    // Tomorrow at 9 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    presets.push({ label: 'Tomorrow at 9 AM', time: tomorrow });

    return presets;
  }

  /**
   * Creates the prompt HTML structure.
   * @param {{ chatId: string, chatName: string }} context
   * @returns {{ overlay: HTMLElement, getSelectedTime: () => number|null, confirmBtn: HTMLElement, cancelBtn: HTMLElement }}
   */
  function createPromptUI(context) {
    const presets = calculatePresets();

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'wa-reminder-prompt-overlay';
    overlay.setAttribute('data-testid', 'wa-reminder-prompt');

    // Card
    const card = document.createElement('div');
    card.className = 'wa-reminder-prompt';

    // Title
    const title = document.createElement('h3');
    title.className = 'wa-reminder-prompt-title';
    title.textContent = 'Set Reminder';

    const subtitle = document.createElement('p');
    subtitle.className = 'wa-reminder-prompt-subtitle';
    subtitle.textContent = `Follow up with ${context.chatName}`;

    // Presets container
    const presetsContainer = document.createElement('div');
    presetsContainer.className = 'wa-reminder-presets';

    let selectedTime = null;

    presets.forEach((preset) => {
      const presetBtn = document.createElement('button');
      presetBtn.className = 'wa-reminder-preset';
      presetBtn.type = 'button';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'wa-reminder-preset-label';
      labelSpan.textContent = preset.label;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'wa-reminder-preset-time';
      timeSpan.textContent = formatPromptTime(preset.time);

      presetBtn.appendChild(labelSpan);
      presetBtn.appendChild(timeSpan);

      presetBtn.addEventListener('click', () => {
        // Deselect all presets
        presetsContainer.querySelectorAll('.wa-reminder-preset').forEach((el) => {
          el.classList.remove('selected');
        });
        presetBtn.classList.add('selected');
        selectedTime = preset.time.getTime();

        // Hide custom picker
        customSection.classList.remove('visible');

        // Update confirm button
        confirmBtn.textContent = `Set reminder for ${formatPromptTime(preset.time)}`;
        confirmBtn.disabled = false;
      });

      presetsContainer.appendChild(presetBtn);
    });

    // Custom option button
    const customBtn = document.createElement('button');
    customBtn.className = 'wa-reminder-preset';
    customBtn.type = 'button';

    const customLabel = document.createElement('span');
    customLabel.className = 'wa-reminder-preset-label';
    customLabel.textContent = 'Custom date & time';

    const customArrow = document.createElement('span');
    customArrow.className = 'wa-reminder-preset-time';
    customArrow.textContent = '▾';

    customBtn.appendChild(customLabel);
    customBtn.appendChild(customArrow);
    presetsContainer.appendChild(customBtn);

    // Custom date/time section
    const customSection = document.createElement('div');
    customSection.className = 'wa-reminder-custom';

    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    // Set min to today
    const today = new Date();
    dateInput.min = today.toISOString().split('T')[0];
    dateInput.value = today.toISOString().split('T')[0];

    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time';
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    // Default to 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    timeInput.value = `${String(defaultTime.getHours()).padStart(2, '0')}:${String(defaultTime.getMinutes()).padStart(2, '0')}`;

    const customError = document.createElement('div');
    customError.className = 'wa-reminder-inline-error';
    customError.style.display = 'none';

    customSection.appendChild(dateLabel);
    customSection.appendChild(dateInput);
    customSection.appendChild(timeLabel);
    customSection.appendChild(timeInput);
    customSection.appendChild(customError);

    const updateCustomTime = () => {
      if (!dateInput.value || !timeInput.value) return;

      const [year, month, day] = dateInput.value.split('-').map(Number);
      const [hours, minutes] = timeInput.value.split(':').map(Number);
      const customDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (customDate.getTime() <= Date.now()) {
        customError.textContent = 'Time must be in the future';
        customError.style.display = 'block';
        confirmBtn.disabled = true;
        selectedTime = null;
        return;
      }

      customError.style.display = 'none';
      selectedTime = customDate.getTime();
      confirmBtn.textContent = `Set reminder for ${formatPromptTime(customDate)}`;
      confirmBtn.disabled = false;
    };

    dateInput.addEventListener('change', updateCustomTime);
    timeInput.addEventListener('change', updateCustomTime);

    customBtn.addEventListener('click', () => {
      presetsContainer.querySelectorAll('.wa-reminder-preset').forEach((el) => {
        el.classList.remove('selected');
      });
      customBtn.classList.add('selected');
      customSection.classList.toggle('visible');
      updateCustomTime();
    });

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'wa-reminder-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'wa-reminder-btn-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'wa-reminder-btn-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Select a time';
    confirmBtn.disabled = true;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    // Error display area
    const errorArea = document.createElement('div');
    errorArea.className = 'wa-reminder-error';
    errorArea.style.display = 'none';

    // Assemble card
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(presetsContainer);
    card.appendChild(customSection);
    card.appendChild(errorArea);
    card.appendChild(actions);

    overlay.appendChild(card);

    // Click overlay (outside card) to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        dismissPrompt();
      }
    });

    // Escape key to cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        dismissPrompt();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return {
      overlay,
      getSelectedTime: () => selectedTime,
      confirmBtn,
      cancelBtn,
      errorArea,
    };
  }

  /**
   * Shows a success confirmation in the prompt overlay.
   * @param {HTMLElement} overlay
   * @param {{ chatName: string }} context
   * @param {number} scheduledTime
   */
  function showSuccess(overlay, context, scheduledTime) {
    const card = overlay.querySelector('.wa-reminder-prompt');
    if (!card) return;

    card.innerHTML = '';

    const success = document.createElement('div');
    success.className = 'wa-reminder-success';

    const icon = document.createElement('div');
    icon.className = 'wa-reminder-success-icon';
    icon.textContent = '✓';

    const title = document.createElement('div');
    title.className = 'wa-reminder-success-title';
    title.textContent = 'Reminder set!';

    const detail = document.createElement('div');
    detail.className = 'wa-reminder-success-detail';
    detail.textContent = `You'll be reminded to follow up with ${context.chatName} at ${formatPromptTime(new Date(scheduledTime))}`;

    success.appendChild(icon);
    success.appendChild(title);
    success.appendChild(detail);
    card.appendChild(success);

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      dismissPrompt();
    }, 2500);
  }

  /**
   * Displays the reminder creation prompt.
   * @param {{ chatId: string, chatName: string }} context - Chat context
   * @param {Element} _header - The header element (unused but available)
   */
  function showPrompt(context, _header) {
    // Remove any existing prompt
    dismissPrompt();

    const { overlay, getSelectedTime, confirmBtn, cancelBtn, errorArea } =
      createPromptUI(context);

    // Cancel handler
    cancelBtn.addEventListener('click', () => {
      dismissPrompt();
    });

    // Confirm handler
    confirmBtn.addEventListener('click', async () => {
      const scheduledTime = getSelectedTime();
      if (!scheduledTime) return;

      // Show loading state
      confirmBtn.classList.add('loading');
      confirmBtn.disabled = true;
      errorArea.style.display = 'none';

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CREATE_REMINDER',
          payload: {
            chatId: context.chatId,
            chatName: context.chatName,
            scheduledTime: scheduledTime,
          },
        });

        if (response && response.success) {
          showSuccess(overlay, context, scheduledTime);
        } else {
          const errorMsg = (response && response.error) || 'Failed to create reminder';
          errorArea.textContent = errorMsg;
          errorArea.style.display = 'block';
          confirmBtn.classList.remove('loading');
          confirmBtn.disabled = false;
        }
      } catch (_err) {
        errorArea.textContent = 'Failed to save reminder. Please try again.';
        errorArea.style.display = 'block';
        confirmBtn.classList.remove('loading');
        confirmBtn.disabled = false;
      }
    });

    document.body.appendChild(overlay);
    currentOverlay = overlay;
  }

  /**
   * Dismisses the current prompt overlay, cleaning up gracefully.
   */
  function dismissPrompt() {
    if (currentOverlay && currentOverlay.parentElement) {
      currentOverlay.remove();
    }
    currentOverlay = null;
  }

  // Clean up on page navigation (WhatsApp SPA route changes)
  window.addEventListener('beforeunload', () => {
    dismissPrompt();
  });

  // Also watch for #main being removed (chat deselected / navigated away)
  const navObserver = new MutationObserver(() => {
    if (currentOverlay && !document.querySelector('#main header')) {
      dismissPrompt();
    }
  });

  const appEl = document.querySelector('#app');
  if (appEl) {
    navObserver.observe(appEl, { childList: true, subtree: true });
  }

  // Expose on global namespace
  window.WAReminder = window.WAReminder || {};
  window.WAReminder.showPrompt = showPrompt;
  window.WAReminder.dismissPrompt = dismissPrompt;
})();
