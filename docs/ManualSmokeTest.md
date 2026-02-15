# Manual Smoke Test Guide

**Extension**: WAReminder — WhatsApp Follow-Up Reminders  
**Date**: 2026-02-15

---

## Prerequisites

- **Google Chrome** (latest stable)
- **WhatsApp Web** — logged in at `web.whatsapp.com`
- **Node.js** ≥ 18 and **npm** ≥ 9 installed
- At least **2 contacts/chats** available in WhatsApp for testing

---

## Step 1: Install Dependencies

```bash
cd /Users/andrew/dev/chromex/wareminder
npm install
```

---

## Step 2: Run Automated Tests First

Confirm all tests pass before manual testing:

```bash
npm test -- --coverage
```

Expected: **110 tests passing**, all coverage thresholds met.

---

## Step 3: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. In the file picker, select the `src/` directory:
   ```
   /Users/andrew/dev/chromex/wareminder/src
   ```
5. The extension card should appear with:
   - Name: **WAReminder - WhatsApp Follow-Up Reminders**
   - Version: **1.0.0**
   - No errors shown (red error badge = problem)
6. **Pin the extension** to the toolbar: click the puzzle-piece icon in the toolbar → find WAReminder → click the pin icon

> **Troubleshooting**: If you see an error on the extension card, click "Errors" to see details. Common issues:
> - `Could not load manifest` → check `src/manifest.json` for syntax errors
> - `Service worker registration failed` → check for import errors in `background/service-worker.js`

---

## Step 4: Verify Extension Loads on WhatsApp Web

1. Open a new tab and go to **`https://web.whatsapp.com`**
2. Wait for WhatsApp Web to fully load (chat list visible)
3. Open **Chrome DevTools** (F12 or Cmd+Opt+I)
4. Check the **Console** tab — there should be no errors from the extension
   - Filter by typing `WAReminder` if the console is noisy

---

## Step 5: Test Button Injection (US1)

### 5a. Button appears in chat header
1. Click on any chat in the sidebar
2. Look at the **chat header** (top bar with contact name)
3. **Verify**: A bell icon (🔔) button appears among the header action buttons
4. Hover over it — tooltip should say **"Set Reminder"**

### 5b. Button persists across chat switches
1. Click a different chat
2. **Verify**: The bell button appears in the new chat's header too
3. Go back to the original chat
4. **Verify**: The bell button is still there (not duplicated)

### 5c. Button injection failure fallback
1. If the button does NOT appear, check the console for:
   ```
   WAReminder: Button injection failed, popup dashboard available as fallback.
   ```
   This means WhatsApp's DOM structure may have changed. The popup dashboard still works independently.

---

## Step 6: Test Reminder Creation (US1)

### 6a. Preset time — "In 1 hour"
1. Open a chat and click the bell (🔔) button
2. **Verify**: A prompt overlay appears with:
   - Title: "Set Reminder"
   - Subtitle: "Follow up with [contact name]"
   - Three preset buttons with resolved date/time displayed
   - A "Custom date & time" option
3. Click **"In 1 hour"**
4. **Verify**: The confirm button updates to show the resolved time (e.g., "Set reminder for Feb 15, 2026 at 4:30 PM")
5. Click the confirm button
6. **Verify**: A success message appears: "Reminder set!" with details
7. The prompt auto-dismisses after ~2.5 seconds

### 6b. Custom date/time
1. Open another chat, click the bell button
2. Click **"Custom date & time"**
3. **Verify**: Date and time input fields appear
4. Set a date/time in the **past**
5. **Verify**: Error message "Time must be in the future" appears, confirm button stays disabled
6. Set a date/time **1–2 minutes in the future** (for testing notifications soon)
7. **Verify**: Confirm button enables with the correct resolved time
8. Click confirm
9. **Verify**: Success message appears

### 6c. Cancel and dismiss
1. Open any chat, click the bell button
2. Click **"Cancel"**
3. **Verify**: Prompt closes
4. Click the bell button again
5. Press **Escape**
6. **Verify**: Prompt closes
7. Click the bell button again
8. Click **outside the prompt card** (on the dark overlay)
9. **Verify**: Prompt closes

---

## Step 7: Test Desktop Notifications (US2)

> **Important**: For this test, you need a reminder set for 1–2 minutes in the future (from step 6b).

### 7a. Notification appears
1. Wait for the scheduled time to arrive
2. **Verify**: A desktop notification appears with:
   - Title: "Follow up: [contact name]"
   - Body including the contact name and scheduled time
   - The notification persists (doesn't auto-dismiss) due to `requireInteraction: true`

### 7b. Notification click opens chat
1. Click on the notification
2. **Verify**: Chrome activates/focuses, and the WhatsApp Web tab navigates to the correct chat
3. If WhatsApp Web was closed, a new tab should open

### 7c. Notification permission check
1. If notifications are blocked for Chrome, the popup should show a warning banner:
   "Notifications are disabled."

---

## Step 8: Test Popup Dashboard (US3)

### 8a. Open popup
1. Click the **WAReminder icon** in the Chrome toolbar
2. **Verify**: The popup opens showing:
   - Header with "WAReminder" and pending count badge
   - Reminders sorted by scheduled time
   - Sections: Overdue (red), Upcoming, Completed

### 8b. Reminder display
1. **Verify** each reminder shows:
   - Contact name
   - Scheduled date/time with relative time (e.g., "in 2h", "3m ago")
   - Status badge for overdue ("Overdue" in red) or completed ("Done")
   - Action buttons: 💬 (open chat), ✓ (mark complete), 🗑 (delete)

### 8c. Open chat from popup
1. Click the 💬 button or click on a reminder's name/time area
2. **Verify**: The WhatsApp Web tab activates and navigates to the correct chat
3. The popup closes (Chrome default popup behavior)

### 8d. Mark complete
1. Reopen the popup
2. Click the ✓ button on a pending reminder
3. **Verify**: The reminder moves to the "Completed" section with a "Done" badge

### 8e. Delete with confirmation
1. Click the 🗑 button on any reminder
2. **Verify**: A confirmation dialog appears: "Delete this reminder?" with contact name and date
3. Click **"Cancel"**
4. **Verify**: Dialog closes, reminder still exists
5. Click 🗑 again, then click **"Delete"**
6. **Verify**: Reminder disappears from the list

### 8f. Empty state
1. Delete all reminders
2. **Verify**: The popup shows the empty state:
   - 🔔 icon
   - "No follow-ups scheduled" (or i18n equivalent)
   - "Open a WhatsApp Web chat to set one!"

---

## Step 9: Test Badge Count (US4)

### 9a. Badge shows pending count
1. Create 2–3 reminders with future times
2. **Verify**: The extension icon in the toolbar shows a badge number matching the pending reminder count

### 9b. Badge updates on completion
1. Open the popup and mark one reminder as complete
2. **Verify**: The badge count decreases by 1

### 9c. Badge clears when none pending
1. Mark all reminders as complete or delete them
2. **Verify**: The badge disappears (no number shown)

---

## Step 10: Test Plan Limits

1. Create **5 reminders** (free plan limit)
2. Try to create a **6th reminder**
3. **Verify**: An error message appears in the prompt: "You've reached the limit of 5 active reminders. Upgrade to create more."
4. Mark one as complete or delete one
5. Try creating again
6. **Verify**: Creation succeeds (now under limit)

---

## Step 11: Test Edge Cases

### 11a. Service worker restart
1. Go to `chrome://extensions/`
2. Click the **reload** button (circular arrow) on the WAReminder card
3. Go back to WhatsApp Web
4. Open the popup
5. **Verify**: All reminders are still there (persisted in storage), alarms are reconciled

### 11b. Multiple WhatsApp tabs
1. Open WhatsApp Web in 2 tabs
2. Create a reminder in tab 1
3. Switch to tab 2 and click a chat
4. **Verify**: The bell button still appears, no errors in console

### 11c. Browser restart simulation
1. Note your current reminders
2. Close and reopen Chrome
3. Go to WhatsApp Web
4. Open the popup
5. **Verify**: All reminders restored, overdue ones show as overdue

---

## Step 12: Check for Console Errors

1. On the WhatsApp Web tab, open DevTools → Console
2. **Verify**: No errors from the extension (warnings are acceptable)
3. Go to `chrome://extensions/` → WAReminder card
4. Click **"Service Worker"** link to open the background DevTools
5. Check the Console tab
6. **Verify**: No errors (only informational logs)

---

## Smoke Test Checklist Summary

Copy this checklist and check off each item:

- [ ] Extension loads without errors at `chrome://extensions/`
- [ ] Bell button visible in WhatsApp Web chat header
- [ ] Bell button appears on chat switch (no duplicates)
- [ ] Reminder creation with "In 1 hour" preset works
- [ ] Reminder creation with custom date/time works
- [ ] Custom picker rejects past times
- [ ] Prompt cancel/escape/overlay-click all dismiss
- [ ] Desktop notification appears at scheduled time
- [ ] Notification includes contact name and scheduled time
- [ ] Clicking notification opens correct chat
- [ ] Popup shows all reminders sorted by date
- [ ] Popup overdue section shows with red styling
- [ ] Open chat from popup works
- [ ] Mark complete moves reminder to completed section
- [ ] Delete shows confirmation, then removes reminder
- [ ] Empty state shows when no reminders
- [ ] Badge count matches pending reminder count
- [ ] Badge updates on complete/delete
- [ ] Badge clears when no pending reminders
- [ ] Plan limit enforced at 5 active reminders
- [ ] Extension survives reload without data loss
- [ ] No console errors in content script or service worker

**Result**: [ ] ALL PASS / [ ] ISSUES FOUND (document below)

### Issues Found
<!-- Document any issues here with steps to reproduce -->
