// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const POPUP_URL = `file://${path.resolve(__dirname, '../../src/popup/popup.html')}`;

const NOW = Date.now();
const IN_1_HOUR = NOW + 60 * 60 * 1000;
const IN_2_HOURS = NOW + 2 * 60 * 60 * 1000;
const AN_HOUR_AGO = NOW - 60 * 60 * 1000;
const YESTERDAY = NOW - 25 * 60 * 60 * 1000;

/**
 * Injects a chrome API mock before popup.js executes.
 * @param {import('@playwright/test').Page} page
 * @param {{ reminders?: object[], permissionLevel?: string }} opts
 */
async function setupChromeMock(page, { reminders = [], permissionLevel = 'granted' } = {}) {
  await page.addInitScript(
    ({ reminders, permissionLevel }) => {
      // Track calls for assertions
      window.__openChatCalls = [];

      window.chrome = {
        i18n: {
          getMessage: (key) => {
            const messages = {
              noReminders: 'No follow-ups scheduled',
              noRemindersDetail: 'Open a WhatsApp Web chat to set one!',
              overdue: 'Overdue',
              upcoming: 'Upcoming',
              completed: 'Completed',
              deleteConfirmTitle: 'Delete this reminder?',
              cancel: 'Cancel',
              deleteReminder: 'Delete',
            };
            return messages[key] || key;
          },
        },
        runtime: {
          lastError: null,
          sendMessage: (msg, callback) => {
            if (msg.type === 'CHECK_NOTIFICATION_PERMISSION') {
              callback({ success: true, data: { permissionLevel } });
            } else if (msg.type === 'GET_REMINDERS') {
              callback({ success: true, data: { reminders } });
            } else if (msg.type === 'COMPLETE_REMINDER') {
              callback({ success: true, data: {} });
            } else if (msg.type === 'DELETE_REMINDER') {
              callback({ success: true, data: {} });
            } else {
              callback({ success: true, data: {} });
            }
          },
          openOptionsPage: () => {},
        },
        storage: {
          onChanged: {
            addListener: () => {},
          },
        },
        tabs: {
          query: () => Promise.resolve([]),
          create: (opts) => {
            window.__openChatCalls.push(opts);
            return Promise.resolve({ id: 1 });
          },
          update: (id, opts) => {
            window.__openChatCalls.push(opts);
            return Promise.resolve({});
          },
        },
        windows: {
          update: () => Promise.resolve({}),
        },
      };
    },
    { reminders, permissionLevel }
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test('shows empty state when there are no reminders', async ({ page }) => {
  await setupChromeMock(page, { reminders: [] });
  await page.goto(POPUP_URL);

  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#reminder-list')).toBeHidden();
  await expect(page.locator('#loading-state')).toBeHidden();
});

test('shows "No follow-ups scheduled" text in empty state', async ({ page }) => {
  await setupChromeMock(page, { reminders: [] });
  await page.goto(POPUP_URL);

  await expect(page.locator('.empty-title')).toHaveText('No follow-ups scheduled');
  await expect(page.locator('.empty-subtitle')).toHaveText('Open a WhatsApp Web chat to set one!');
});

// ---------------------------------------------------------------------------
// Upcoming reminders
// ---------------------------------------------------------------------------

test('shows reminder list with upcoming reminders', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
      { id: 'r2', chatId: 'c2', chatName: 'Bob', scheduledTime: IN_2_HOURS, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#reminder-list')).toBeVisible();
  await expect(page.locator('#empty-state')).toBeHidden();
  await expect(page.locator('#upcoming-section')).toBeVisible();
});

test('displays correct reminder names for upcoming reminders', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
      { id: 'r2', chatId: 'c2', chatName: 'Bob', scheduledTime: IN_2_HOURS, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  const names = page.locator('.reminder-name');
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveText('Alice');
  await expect(names.nth(1)).toHaveText('Bob');
});

test('shows pending count in header', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
      { id: 'r2', chatId: 'c2', chatName: 'Bob', scheduledTime: IN_2_HOURS, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#reminder-count')).toHaveText('2 pending');
});

test('upcoming reminder shows complete (✓) and delete (🗑) buttons', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  const item = page.locator('.reminder-item').first();
  await expect(item.locator('.action-btn--complete')).toBeVisible();
  await expect(item.locator('.action-btn--delete')).toBeVisible();
  await expect(item.locator('.action-btn--open')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Overdue reminders
// ---------------------------------------------------------------------------

test('shows overdue section for past-due pending reminders', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Charlie', scheduledTime: AN_HOUR_AGO, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#overdue-section')).toBeVisible();
  await expect(page.locator('.reminder-item--overdue')).toBeVisible();
  await expect(page.locator('.reminder-status-badge--overdue')).toHaveText('Overdue');
});

test('overdue reminder still shows complete and delete buttons', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Charlie', scheduledTime: AN_HOUR_AGO, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  const item = page.locator('.reminder-item--overdue').first();
  await expect(item.locator('.action-btn--complete')).toBeVisible();
  await expect(item.locator('.action-btn--delete')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Completed reminders
// ---------------------------------------------------------------------------

test('shows completed section with Done badge', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Dave', scheduledTime: YESTERDAY, status: 'completed' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#completed-section')).toBeVisible();
  await expect(page.locator('.reminder-status-badge--completed')).toHaveText('Done');
});

test('completed reminder does not show a complete button', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Dave', scheduledTime: YESTERDAY, status: 'completed' },
    ],
  });
  await page.goto(POPUP_URL);

  const item = page.locator('.reminder-item--completed').first();
  await expect(item.locator('.action-btn--complete')).toHaveCount(0);
  await expect(item.locator('.action-btn--delete')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Notification warning
// ---------------------------------------------------------------------------

test('hides notification warning when permission is granted', async ({ page }) => {
  await setupChromeMock(page, { permissionLevel: 'granted' });
  await page.goto(POPUP_URL);

  await expect(page.locator('#notification-warning')).toBeHidden();
});

test('shows notification warning when permission is denied', async ({ page }) => {
  await setupChromeMock(page, { permissionLevel: 'denied' });
  await page.goto(POPUP_URL);

  await expect(page.locator('#notification-warning')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Delete dialog
// ---------------------------------------------------------------------------

test('opens delete dialog when delete button is clicked', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  // Dialog should start hidden
  await expect(page.locator('#delete-dialog')).toBeHidden();

  // Click delete button
  await page.locator('.action-btn--delete').first().click();

  // Dialog should now be visible
  await expect(page.locator('#delete-dialog')).toBeVisible();
});

test('cancel button closes the delete dialog', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Alice', scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await page.locator('.action-btn--delete').first().click();
  await expect(page.locator('#delete-dialog')).toBeVisible();

  await page.locator('#delete-cancel').click();
  await expect(page.locator('#delete-dialog')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Mixed sections
// ---------------------------------------------------------------------------

test('renders all three sections when all statuses are present', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: 'c1', chatName: 'Overdue Person', scheduledTime: AN_HOUR_AGO, status: 'pending' },
      { id: 'r2', chatId: 'c2', chatName: 'Future Person', scheduledTime: IN_1_HOUR, status: 'pending' },
      { id: 'r3', chatId: 'c3', chatName: 'Done Person', scheduledTime: YESTERDAY, status: 'completed' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#overdue-section')).toBeVisible();
  await expect(page.locator('#upcoming-section')).toBeVisible();
  await expect(page.locator('#completed-section')).toBeVisible();
  await expect(page.locator('#reminder-count')).toHaveText('2 pending');
});

// ---------------------------------------------------------------------------
// Group chat reminders (@g.us)
// ---------------------------------------------------------------------------

const GROUP_CHAT_ID = '120363123456789@g.us';
const GROUP_CHAT_NAME = 'Family Group';
const INDIVIDUAL_CHAT_ID = '5511999999999@c.us';
const INDIVIDUAL_CHAT_NAME = 'Alice';

test('group chat reminder renders with correct name', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('.reminder-name').first()).toHaveText(GROUP_CHAT_NAME);
  await expect(page.locator('#upcoming-section')).toBeVisible();
});

test('group chat overdue reminder shows Overdue badge', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime: AN_HOUR_AGO, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#overdue-section')).toBeVisible();
  await expect(page.locator('.reminder-status-badge--overdue')).toHaveText('Overdue');
  await expect(page.locator('.reminder-name').first()).toHaveText(GROUP_CHAT_NAME);
});

test('group chat completed reminder shows Done badge', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime: YESTERDAY, status: 'completed' },
    ],
  });
  await page.goto(POPUP_URL);

  await expect(page.locator('#completed-section')).toBeVisible();
  await expect(page.locator('.reminder-status-badge--completed')).toHaveText('Done');
});

test('open-chat on a group chat navigates to base WhatsApp URL (no deep-link)', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: GROUP_CHAT_ID, chatName: GROUP_CHAT_NAME, scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await page.locator('.action-btn--open').first().click();

  // Give the async openChat call time to resolve
  await page.waitForFunction(() => window.__openChatCalls.length > 0);

  const calls = await page.evaluate(() => window.__openChatCalls);
  expect(calls[0].url).toBe('https://web.whatsapp.com');
});

test('open-chat on an individual chat deep-links with phone number', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: INDIVIDUAL_CHAT_ID, chatName: INDIVIDUAL_CHAT_NAME, scheduledTime: IN_1_HOUR, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  await page.locator('.action-btn--open').first().click();

  await page.waitForFunction(() => window.__openChatCalls.length > 0);

  const calls = await page.evaluate(() => window.__openChatCalls);
  expect(calls[0].url).toContain('send?phone=5511999999999');
});

test('group and individual reminders both appear together in correct sections', async ({ page }) => {
  await setupChromeMock(page, {
    reminders: [
      { id: 'r1', chatId: GROUP_CHAT_ID, chatName: 'Work Team', scheduledTime: IN_1_HOUR, status: 'pending' },
      { id: 'r2', chatId: INDIVIDUAL_CHAT_ID, chatName: 'Alice', scheduledTime: IN_2_HOURS, status: 'pending' },
      { id: 'r3', chatId: '120363000000001@g.us', chatName: 'Project Chat', scheduledTime: AN_HOUR_AGO, status: 'pending' },
    ],
  });
  await page.goto(POPUP_URL);

  // 2 overdue + upcoming rendered
  await expect(page.locator('#overdue-section')).toBeVisible();
  await expect(page.locator('#upcoming-section')).toBeVisible();

  // All three names present
  const names = page.locator('.reminder-name');
  await expect(names).toHaveCount(3);

  // Count shows both pending
  await expect(page.locator('#reminder-count')).toHaveText('3 pending');
});
