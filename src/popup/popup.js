// @ts-check

/**
 * WAReminder Popup Dashboard.
 * Renders reminder list sorted by scheduledTime, supports open chat,
 * mark complete, delete, and pagination for large lists.
 * @module popup
 */

(function PopupDashboard() {
  'use strict';

  /** @readonly */
  const ITEMS_PER_PAGE = 50;

  /** @readonly */
  const MESSAGE_TYPES = {
    GET_REMINDERS: 'GET_REMINDERS',
    COMPLETE_REMINDER: 'COMPLETE_REMINDER',
    DELETE_REMINDER: 'DELETE_REMINDER',
    CHECK_NOTIFICATION_PERMISSION: 'CHECK_NOTIFICATION_PERMISSION',
    GET_PLAN_STATUS: 'GET_PLAN_STATUS',
  };

  // --- DOM References ---
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const reminderList = document.getElementById('reminder-list');
  const overdueSection = document.getElementById('overdue-section');
  const upcomingSection = document.getElementById('upcoming-section');
  const completedSection = document.getElementById('completed-section');
  const overdueItems = document.getElementById('overdue-items');
  const upcomingItems = document.getElementById('upcoming-items');
  const completedItems = document.getElementById('completed-items');
  const reminderCount = document.getElementById('reminder-count');
  const notificationWarning = document.getElementById('notification-warning');
  const enableNotificationsLink = document.getElementById('enable-notifications-link');
  const pagination = document.getElementById('pagination');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');
  const deleteDialog = document.getElementById('delete-dialog');
  const deleteDialogDetail = document.getElementById('delete-dialog-detail');
  const deleteCancelBtn = document.getElementById('delete-cancel');
  const deleteConfirmBtn = document.getElementById('delete-confirm');

  // --- State ---
  let allReminders = [];
  let currentPage = 1;
  let pendingDeleteId = null;

  // --- Init ---
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    applyI18n();
    setupEventListeners();
    setupStorageListener();
    await checkNotificationPermission();
    await loadReminders();
  }

  /**
   * Applies i18n strings from chrome.i18n to all elements with data-i18n attributes.
   */
  function applyI18n() {
    if (!chrome.i18n || !chrome.i18n.getMessage) return;
    const elements = document.querySelectorAll('[data-i18n]');
    for (const el of elements) {
      const key = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(key);
      if (msg) {
        el.textContent = msg;
      }
    }
  }

  function setupEventListeners() {
    if (prevPageBtn) prevPageBtn.addEventListener('click', goToPrevPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', goToNextPage);
    if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', hideDeleteDialog);
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', confirmDelete);
    if (enableNotificationsLink) {
      enableNotificationsLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Open Chrome extension settings - notifications can be enabled there
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      });
    }
  }

  /**
   * Listens for storage changes to reactively update the popup.
   */
  function setupStorageListener() {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.reminders) {
          allReminders = changes.reminders.newValue || [];
          renderReminders();
        }
      });
    }
  }

  // --- Data Loading ---

  /**
   * Sends a message to the service worker and returns the response.
   * @param {object} message - Message to send
   * @returns {Promise<object>} Response from service worker
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  /**
   * Loads all reminders from storage via service worker.
   * @returns {Promise<void>}
   */
  async function loadReminders() {
    showLoading();
    try {
      const data = await sendMessage({ type: MESSAGE_TYPES.GET_REMINDERS });
      allReminders = data.reminders || [];
      currentPage = 1;
      renderReminders();
    } catch (err) {
      console.error('Failed to load reminders:', err);
      allReminders = [];
      renderReminders();
    }
  }

  /**
   * Checks notification permission and shows warning if denied.
   * @returns {Promise<void>}
   */
  async function checkNotificationPermission() {
    try {
      const data = await sendMessage({ type: MESSAGE_TYPES.CHECK_NOTIFICATION_PERMISSION });
      if (data.permissionLevel !== 'granted' && notificationWarning) {
        notificationWarning.hidden = false;
      }
    } catch {
      // Silently fail — not critical
    }
  }

  // --- Rendering ---

  /**
   * Renders the reminder list with overdue/upcoming/completed sections.
   */
  function renderReminders() {
    hideLoading();

    if (allReminders.length === 0) {
      showEmptyState();
      return;
    }

    hideEmptyState();
    showReminderList();

    const now = Date.now();

    // Sort by scheduledTime (soonest first)
    const sorted = [...allReminders].sort((a, b) => a.scheduledTime - b.scheduledTime);

    // Categorize (for header counts)
    const overdue = sorted.filter((r) => r.status === 'pending' && r.scheduledTime <= now);
    const upcoming = sorted.filter((r) => r.status === 'pending' && r.scheduledTime > now);

    // Pagination
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageItems = sorted.slice(startIdx, endIdx);

    // Re-categorize for current page
    const pageOverdue = pageItems.filter((r) => r.status === 'pending' && r.scheduledTime <= now);
    const pageUpcoming = pageItems.filter((r) => r.status === 'pending' && r.scheduledTime > now);
    const pageCompleted = pageItems.filter((r) => r.status === 'completed');

    // Render sections
    renderSection(overdueSection, overdueItems, pageOverdue, 'overdue');
    renderSection(upcomingSection, upcomingItems, pageUpcoming, 'upcoming');
    renderSection(completedSection, completedItems, pageCompleted, 'completed');

    // Update count
    const pendingCount = overdue.length + upcoming.length;
    if (reminderCount) {
      reminderCount.textContent = pendingCount > 0 ? `${pendingCount} pending` : '';
    }

    // Pagination controls
    if (totalPages > 1 && pagination) {
      pagination.hidden = false;
      if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
      if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
      if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    } else if (pagination) {
      pagination.hidden = true;
    }
  }

  /**
   * Renders a section of reminders.
   * @param {HTMLElement|null} section - Section container
   * @param {HTMLElement|null} container - Items container
   * @param {Array<object>} items - Reminder items
   * @param {string} type - 'overdue' | 'upcoming' | 'completed'
   */
  function renderSection(section, container, items, type) {
    if (!section || !container) return;

    if (items.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    container.innerHTML = '';

    for (const reminder of items) {
      container.appendChild(createReminderElement(reminder, type));
    }
  }

  /**
   * Creates a DOM element for a single reminder.
   * @param {object} reminder - Reminder data
   * @param {string} type - 'overdue' | 'upcoming' | 'completed'
   * @returns {HTMLElement}
   */
  function createReminderElement(reminder, type) {
    const item = document.createElement('div');
    item.className = `reminder-item${type === 'overdue' ? ' reminder-item--overdue' : ''}${type === 'completed' ? ' reminder-item--completed' : ''}`;
    item.dataset.id = reminder.id;

    // Info section (clickable to open chat)
    const info = document.createElement('div');
    info.className = 'reminder-info';
    info.addEventListener('click', () => openChat(reminder.chatId));
    info.title = 'Open chat in WhatsApp Web';

    const name = document.createElement('div');
    name.className = 'reminder-name';
    name.textContent = reminder.chatName;

    const time = document.createElement('div');
    time.className = `reminder-time${type === 'overdue' ? ' reminder-time--overdue' : ''}`;
    time.textContent = formatTime(reminder, type);

    info.appendChild(name);
    info.appendChild(time);
    item.appendChild(info);

    // Status badge for overdue/completed
    if (type === 'overdue') {
      const badge = document.createElement('span');
      badge.className = 'reminder-status-badge reminder-status-badge--overdue';
      badge.textContent = 'Overdue';
      item.appendChild(badge);
    } else if (type === 'completed') {
      const badge = document.createElement('span');
      badge.className = 'reminder-status-badge reminder-status-badge--completed';
      badge.textContent = 'Done';
      item.appendChild(badge);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    // Open Chat button
    const openBtn = document.createElement('button');
    openBtn.className = 'action-btn action-btn--open';
    openBtn.title = 'Open chat';
    openBtn.textContent = '💬';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openChat(reminder.chatId);
    });
    actions.appendChild(openBtn);

    // Complete button (only for pending)
    if (reminder.status === 'pending') {
      const completeBtn = document.createElement('button');
      completeBtn.className = 'action-btn action-btn--complete';
      completeBtn.title = 'Mark complete';
      completeBtn.textContent = '✓';
      completeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        markComplete(reminder.id, completeBtn);
      });
      actions.appendChild(completeBtn);
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.title = 'Delete';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteDialog(reminder);
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    return item;
  }

  /**
   * Formats the time display for a reminder.
   * @param {object} reminder - Reminder data
   * @param {string} type - 'overdue' | 'upcoming' | 'completed'
   * @returns {string}
   */
  function formatTime(reminder, type) {
    const date = new Date(reminder.scheduledTime);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (type === 'overdue') {
      const elapsed = formatRelativeElapsed(Date.now() - reminder.scheduledTime);
      return `Was due ${dateStr} at ${timeStr} (${elapsed} ago)`;
    }
    if (type === 'completed') {
      return `Completed — was due ${dateStr} at ${timeStr}`;
    }
    const remaining = formatRelativeElapsed(reminder.scheduledTime - Date.now());
    return `${dateStr} at ${timeStr} (in ${remaining})`;
  }

  /**
   * Formats elapsed milliseconds into a human-readable string.
   * @param {number} ms - Milliseconds (positive)
   * @returns {string}
   */
  function formatRelativeElapsed(ms) {
    const absMs = Math.abs(ms);
    const minutes = Math.floor(absMs / 60000);
    const hours = Math.floor(absMs / 3600000);
    const days = Math.floor(absMs / 86400000);

    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }

  // --- Actions ---

  /**
   * Opens a WhatsApp Web chat by sending a message to the service worker.
   * @param {string} chatId - Chat JID
   */
  async function openChat(chatId) {
    try {
      // Build the URL and open it directly
      const phone = chatId.replace('@c.us', '').replace('@g.us', '');
      const url = chatId.endsWith('@c.us')
        ? `https://web.whatsapp.com/send?phone=${phone}`
        : 'https://web.whatsapp.com';

      // Find or create WhatsApp tab
      const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { url, active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url, active: true });
      }
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  }

  /**
   * Marks a reminder as complete.
   * @param {string} reminderId - Reminder ID
   * @param {HTMLButtonElement} btn - The button element (to disable during save)
   */
  async function markComplete(reminderId, btn) {
    btn.disabled = true;
    try {
      await sendMessage({
        type: MESSAGE_TYPES.COMPLETE_REMINDER,
        payload: { reminderId },
      });
      // Remove from local list and re-render
      const idx = allReminders.findIndex((r) => r.id === reminderId);
      if (idx !== -1) {
        allReminders[idx].status = 'completed';
        allReminders[idx].completedAt = Date.now();
      }
      renderReminders();
    } catch (err) {
      console.error('Failed to complete reminder:', err);
      btn.disabled = false;
    }
  }

  /**
   * Shows the delete confirmation dialog.
   * @param {object} reminder - Reminder to delete
   */
  function showDeleteDialog(reminder) {
    pendingDeleteId = reminder.id;
    if (deleteDialogDetail) {
      deleteDialogDetail.textContent = `"${reminder.chatName}" — ${new Date(reminder.scheduledTime).toLocaleDateString()}`;
    }
    if (deleteDialog) deleteDialog.hidden = false;
  }

  /**
   * Hides the delete confirmation dialog.
   */
  function hideDeleteDialog() {
    pendingDeleteId = null;
    if (deleteDialog) deleteDialog.hidden = true;
  }

  /**
   * Confirms and executes the delete action.
   */
  async function confirmDelete() {
    if (!pendingDeleteId) return;

    const reminderId = pendingDeleteId;
    hideDeleteDialog();

    try {
      await sendMessage({
        type: MESSAGE_TYPES.DELETE_REMINDER,
        payload: { reminderId },
      });
      // Remove from local list and re-render
      allReminders = allReminders.filter((r) => r.id !== reminderId);
      renderReminders();
    } catch (err) {
      console.error('Failed to delete reminder:', err);
    }
  }

  // --- Pagination ---

  function goToPrevPage() {
    if (currentPage > 1) {
      currentPage--;
      renderReminders();
    }
  }

  function goToNextPage() {
    const totalPages = Math.ceil(allReminders.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderReminders();
    }
  }

  // --- UI State Helpers ---

  function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (emptyState) emptyState.hidden = true;
    if (reminderList) reminderList.hidden = true;
  }

  function hideLoading() {
    if (loadingState) loadingState.hidden = true;
  }

  function showEmptyState() {
    if (emptyState) emptyState.hidden = false;
    if (reminderList) reminderList.hidden = true;
    if (pagination) pagination.hidden = true;
    if (reminderCount) reminderCount.textContent = '';
  }

  function hideEmptyState() {
    if (emptyState) emptyState.hidden = true;
  }

  function showReminderList() {
    if (reminderList) reminderList.hidden = false;
  }

  // --- Expose for testing ---
  if (typeof window !== 'undefined') {
    window.WAReminder = window.WAReminder || {};
    window.WAReminder.popup = {
      loadReminders,
      renderReminders,
      markComplete,
      confirmDelete,
      showDeleteDialog,
      hideDeleteDialog,
      openChat,
      sendMessage,
    };
  }
})();
