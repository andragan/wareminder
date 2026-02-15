// @ts-check

/**
 * Time-selection prompt UI for creating reminders.
 * Shows preset options (1 hour, tonight, tomorrow) and custom date/time picker.
 * Each preset resolves and displays the absolute datetime before user confirms.
 * @module reminder-prompt
 */

(function () {
  'use strict';

  /**
   * Helper to get i18n message with fallback.
   * @param {string} key - Message key
   * @param {string[]|string} [substitutions] - Substitution values or fallback
   * @param {string} [fallback] - Fallback text
   * @returns {string}
   */
  function i18n(key, substitutions, fallback) {
    if (typeof substitutions === 'string' && fallback === undefined) {
      fallback = substitutions;
      substitutions = undefined;
    }
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    }
    return fallback || key;
  }

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
    presets.push({ label: i18n('presetOneHour', 'In 1 hour'), time: oneHour });

    // Tonight at 8 PM
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() <= now.getTime()) {
      // If past 8 PM, set to tomorrow at 8 PM
      tonight.setDate(tonight.getDate() + 1);
    }
    presets.push({ label: i18n('presetTonight', 'Tonight at 8 PM'), time: tonight });

    // Tomorrow at 9 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    presets.push({ label: i18n('presetTomorrow', 'Tomorrow at 9 AM'), time: tomorrow });

    return presets;
  }

  /**
   * Creates preset time-selection buttons.
   * @param {Array<{ label: string, time: Date }>} presets
   * @param {HTMLElement} confirmBtn
   * @param {HTMLElement} customSection
   * @param {{ value: number|null }} state - Shared state for selectedTime
   * @returns {HTMLElement}
   */
  function createPresetsContainer(presets, confirmBtn, customSection, state) {
    const presetsContainer = document.createElement('div');
    presetsContainer.className = 'wa-reminder-presets';

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
        presetsContainer.querySelectorAll('.wa-reminder-preset').forEach((el) => {
          el.classList.remove('selected');
        });
        presetBtn.classList.add('selected');
        state.value = preset.time.getTime();
        customSection.classList.remove('visible');
        confirmBtn.textContent = i18n('confirmReminder', [formatPromptTime(preset.time)], `Set reminder for ${formatPromptTime(preset.time)}`);
        confirmBtn.disabled = false;
      });

      presetsContainer.appendChild(presetBtn);
    });

    return presetsContainer;
  }

  /**
   * Creates the custom date/time picker section.
   * @param {HTMLElement} confirmBtn
   * @param {{ value: number|null }} state - Shared state for selectedTime
   * @returns {{ section: HTMLElement, errorEl: HTMLElement }}
   */
  function createCustomDateTimeSection(confirmBtn, state) {
    const customSection = document.createElement('div');
    customSection.className = 'wa-reminder-custom';

    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    const today = new Date();
    dateInput.min = today.toISOString().split('T')[0];
    dateInput.value = today.toISOString().split('T')[0];

    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time';
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    timeInput.value = `${String(defaultTime.getHours()).padStart(2, '0')}:${String(defaultTime.getMinutes()).padStart(2, '0')}`;

    const customError = document.createElement('div');
    customError.className = 'wa-reminder-inline-error';
    customError.style.display = 'none';

    const updateCustomTime = () => {
      if (!dateInput.value || !timeInput.value) return;
      const [year, month, day] = dateInput.value.split('-').map(Number);
      const [hours, minutes] = timeInput.value.split(':').map(Number);
      const customDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (customDate.getTime() <= Date.now()) {
        customError.textContent = i18n('invalidTime', 'Time must be in the future');
        customError.style.display = 'block';
        confirmBtn.disabled = true;
        state.value = null;
        return;
      }

      customError.style.display = 'none';
      state.value = customDate.getTime();
      confirmBtn.textContent = i18n('confirmReminder', [formatPromptTime(customDate)], `Set reminder for ${formatPromptTime(customDate)}`);
      confirmBtn.disabled = false;
    };

    dateInput.addEventListener('change', updateCustomTime);
    timeInput.addEventListener('change', updateCustomTime);

    customSection.appendChild(dateLabel);
    customSection.appendChild(dateInput);
    customSection.appendChild(timeLabel);
    customSection.appendChild(timeInput);
    customSection.appendChild(customError);

    // Attach updater for external use
    customSection._updateCustomTime = updateCustomTime;

    return { section: customSection, errorEl: customError };
  }

  /**
   * Appends the "Custom date & time" toggle button to presets container.
   * @param {HTMLElement} presetsContainer
   * @param {HTMLElement} customSection
   */
  function addCustomToggleButton(presetsContainer, customSection) {
    const customBtn = document.createElement('button');
    customBtn.className = 'wa-reminder-preset';
    customBtn.type = 'button';

    const customLabel = document.createElement('span');
    customLabel.className = 'wa-reminder-preset-label';
    customLabel.textContent = i18n('presetCustom', 'Custom date & time');

    const customArrow = document.createElement('span');
    customArrow.className = 'wa-reminder-preset-time';
    customArrow.textContent = '▾';

    customBtn.appendChild(customLabel);
    customBtn.appendChild(customArrow);
    presetsContainer.appendChild(customBtn);

    customBtn.addEventListener('click', () => {
      presetsContainer.querySelectorAll('.wa-reminder-preset').forEach((el) => {
        el.classList.remove('selected');
      });
      customBtn.classList.add('selected');
      customSection.classList.toggle('visible');
      if (customSection._updateCustomTime) {
        customSection._updateCustomTime();
      }
    });
  }

  /**
   * Creates the prompt HTML structure.
   * @param {{ chatId: string, chatName: string }} context
   * @returns {{ overlay: HTMLElement, getSelectedTime: () => number|null, confirmBtn: HTMLElement, cancelBtn: HTMLElement, errorArea: HTMLElement }}
   */
  function createPromptUI(context) {
    const presets = calculatePresets();
    const state = { value: null };

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
    title.textContent = i18n('setReminder', 'Set Reminder');

    const subtitle = document.createElement('p');
    subtitle.className = 'wa-reminder-prompt-subtitle';
    subtitle.textContent = `Follow up with ${context.chatName}`;

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'wa-reminder-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'wa-reminder-btn-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = i18n('cancel', 'Cancel');

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'wa-reminder-btn-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = i18n('confirmReminder', 'Select a time');
    confirmBtn.disabled = true;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    // Build custom section first (needed by presets for toggling)
    const { section: customSection } = createCustomDateTimeSection(confirmBtn, state);

    // Build preset buttons
    const presetsContainer = createPresetsContainer(presets, confirmBtn, customSection, state);
    addCustomToggleButton(presetsContainer, customSection);

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
      getSelectedTime: () => state.value,
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
    title.textContent = i18n('reminderCreated', 'Reminder set!');

    const detail = document.createElement('div');
    detail.className = 'wa-reminder-success-detail';
    detail.textContent = i18n('reminderCreatedDetail', [context.chatName, formatPromptTime(new Date(scheduledTime))], `You'll be reminded to follow up with ${context.chatName} at ${formatPromptTime(new Date(scheduledTime))}`);

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
            console.error('Failed to create reminder:', response && response.error);
          const errorMsg = (response && response.error) || i18n('storageError', 'Failed to create reminder');
          errorArea.textContent = errorMsg;
          errorArea.style.display = 'block';
          confirmBtn.classList.remove('loading');
          confirmBtn.disabled = false;
        }
      } catch (_err) {
        console.error('Error creating reminder:', _err);
        errorArea.textContent = i18n('storageError', 'Failed to save reminder. Please try again.');
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
