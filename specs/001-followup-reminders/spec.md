# Feature Specification: WhatsApp Follow-Up Reminder Extension (MVP)

**Feature Branch**: `001-followup-reminders`  
**Created**: 2026-02-15  
**Status**: Draft  
**Input**: User description: "Implement the feature specification based on the updated constitution and the master plan"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Follow-Up Reminder (Priority: P1)

A small business owner is chatting with a customer on WhatsApp Web. The customer says "I'll think about it." The business owner wants to remember to follow up tomorrow. They click a "Set Reminder" button visible in the chat header, choose "Tomorrow" from a short list of preset times, and see a confirmation that the reminder has been saved. The entire interaction takes a few seconds and does not interrupt the conversation.

**Why this priority**: This is the core value proposition of the product. Without the ability to create reminders, no other feature is useful. Every other story depends on reminders existing in the system.

**Independent Test**: Can be fully tested by opening any WhatsApp Web chat, clicking "Set Reminder," selecting a time, and verifying the reminder appears in storage. Delivers immediate value — the user has captured their intent to follow up.

**Acceptance Scenarios**:

1. **Given** a user is viewing an open chat on WhatsApp Web, **When** they click the "Set Reminder" button in the chat header, **Then** a time-selection prompt appears with preset options (1 hour, tonight, tomorrow, custom date/time).
2. **Given** the time-selection prompt is visible, **When** the user selects "Tomorrow," **Then** the reminder is saved and a brief confirmation message appears within the chat interface.
3. **Given** the user selects "Custom date/time," **When** they pick a date and time in the future and confirm, **Then** the reminder is saved with that exact date/time.
4. **Given** the user selects a date/time in the past, **When** they attempt to confirm, **Then** an inline error message explains that the reminder time must be in the future.
5. **Given** the user is on the free plan and already has 5 active reminders, **When** they attempt to create a 6th reminder, **Then** the system shows a message explaining the free-plan limit and offers an upgrade path.

---

### User Story 2 - Receive a Follow-Up Notification (Priority: P2)

A business owner set a reminder yesterday for "tomorrow at 9 AM." It is now 9 AM. The extension triggers a desktop notification that includes the customer's name and a short label. The business owner clicks the notification and is taken directly to the relevant WhatsApp Web chat, ready to type their follow-up message.

**Why this priority**: Notifications close the loop on the reminder. Without them, reminders are just a list the user must manually check. Notifications are what transform the extension from a note-taking tool into an active follow-up assistant.

**Independent Test**: Can be tested by creating a reminder set to fire 1 minute in the future, waiting for the notification to appear, clicking it, and verifying the correct chat opens in WhatsApp Web.

**Acceptance Scenarios**:

1. **Given** a reminder's scheduled time has arrived, **When** the background process checks pending reminders, **Then** a desktop notification is displayed containing the customer name and the reminder time.
2. **Given** a notification is visible, **When** the user clicks the notification, **Then** the browser navigates to or focuses the WhatsApp Web tab and opens the associated chat.
3. **Given** the WhatsApp Web tab is closed when a notification fires, **When** the user clicks the notification, **Then** a new WhatsApp Web tab opens and navigates to the correct chat.
4. **Given** multiple reminders are due at the same time, **When** the background process runs, **Then** each reminder generates its own notification (no batching or dropping).

---

### User Story 3 - View and Manage All Reminders (Priority: P3)

A business owner wants to see all their pending follow-ups at a glance. They click the extension icon in the Chrome toolbar and a popup dashboard appears, listing all reminders sorted by due date. From this dashboard they can open the associated chat, mark a reminder as complete, or delete a reminder they no longer need.

**Why this priority**: The dashboard provides oversight and control. While creating and receiving notifications covers the primary workflow, users need a way to review, triage, and clean up their reminders. This story also enables the badge count (Story 4) by surfacing the data it depends on.

**Independent Test**: Can be tested by creating several reminders (some overdue, some upcoming), opening the popup, and verifying all reminders appear with correct data. Each action (open chat, complete, delete) can be exercised independently.

**Acceptance Scenarios**:

1. **Given** a user has active reminders, **When** they click the extension icon, **Then** a popup displays all reminders sorted by due date (soonest first), showing customer name, due date/time, and status.
2. **Given** the reminder list is displayed, **When** the user clicks "Open Chat" on a reminder, **Then** the browser focuses or opens WhatsApp Web and navigates to that chat.
3. **Given** the reminder list is displayed, **When** the user clicks "Mark Complete" on a reminder, **Then** the reminder status changes to "completed" and it moves to a completed section or is visually distinguished.
4. **Given** the reminder list is displayed, **When** the user clicks "Delete" on a reminder, **Then** the reminder is removed permanently after a brief confirmation prompt.
5. **Given** the user has no active reminders, **When** they open the popup, **Then** a friendly empty-state message is shown (e.g., "No follow-ups scheduled. Open a chat to set one!").

---

### User Story 4 - See Pending Reminder Count on Extension Badge (Priority: P4)

A business owner glances at their Chrome toolbar and sees the extension icon displaying a small badge with the number "3." This tells them at a glance that they have three pending follow-ups without needing to open the popup.

**Why this priority**: The badge is a lightweight awareness feature. It adds polish and reduces cognitive load but does not enable any new workflow. It depends on reminder data being reliably stored (Story 1) and status tracking (Story 3).

**Independent Test**: Can be tested by creating reminders and verifying the badge count increments, then completing or deleting reminders and verifying the badge decrements. When count reaches zero the badge disappears.

**Acceptance Scenarios**:

1. **Given** the user has pending (not completed, not deleted) reminders, **When** the extension badge updates, **Then** the badge displays the exact count of pending reminders.
2. **Given** the user completes or deletes a reminder, **When** the storage updates, **Then** the badge count decreases by one.
3. **Given** the user has zero pending reminders, **When** the badge updates, **Then** no badge is shown on the extension icon (badge is cleared).

---

### Edge Cases

- What happens when WhatsApp Web's DOM structure changes and the "Set Reminder" button cannot be injected? The extension MUST detect injection failure, log a warning, and display a fallback notification guiding the user to the popup dashboard to create reminders manually.
- What happens when the user navigates away from WhatsApp Web while a reminder prompt is open? The prompt MUST be dismissed gracefully without saving an incomplete reminder.
- How does the system handle reminders for chats that have been deleted or are no longer accessible? The notification MUST still fire; if the chat cannot be opened, the notification click MUST show an inline message explaining the chat is unavailable.
- What happens if Chrome storage reaches its quota? The system MUST warn the user before the limit is reached (e.g., at 90% capacity) and prevent data loss by refusing to create new reminders rather than silently failing.
- What happens when the user's device clock is significantly wrong? Reminder scheduling MUST use the device clock as the source of truth but MUST display the scheduled time explicitly so the user can verify correctness.
- What happens when the extension is updated while reminders are pending? All existing reminders MUST survive extension updates without data loss or alarm de-registration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST inject a "Set Reminder" button into the WhatsApp Web chat header that is visually consistent with WhatsApp's native UI elements.
- **FR-002**: System MUST present time-selection options when the user initiates reminder creation: "In 1 hour," "Tonight" (8:00 PM local time), "Tomorrow" (9:00 AM local time), and "Custom date/time."
- **FR-003**: System MUST validate that the selected reminder time is in the future and display an inline error if it is not.
- **FR-004**: System MUST persist each reminder with the associated chat identifier, chat/contact name, scheduled time, creation timestamp, and status (pending, completed).
- **FR-005**: System MUST trigger a desktop notification when a reminder's scheduled time arrives, including the contact name and scheduled time.
- **FR-006**: System MUST navigate the user to the correct WhatsApp Web chat when a notification is clicked.
- **FR-007**: System MUST provide a popup dashboard listing all reminders sorted by due date with actions to open the chat, mark complete, and delete.
- **FR-008**: System MUST update the extension icon badge to reflect the count of pending reminders in real time.
- **FR-009**: System MUST enforce the free-plan limit of 5 active reminders and display a clear upgrade message when the limit is reached.
- **FR-010**: System MUST allow users to delete a reminder with a confirmation step to prevent accidental deletion.
- **FR-011**: System MUST retain all reminder data across browser restarts and extension updates.
- **FR-012**: System MUST display a user-friendly empty state in the popup when no reminders exist.
- **FR-013**: System MUST detect when the "Set Reminder" button cannot be injected into WhatsApp Web's DOM and provide a fallback path through the popup.
- **FR-014**: System MUST handle notification clicks when WhatsApp Web is not open by launching a new tab to the correct chat URL.
- **FR-015**: System MUST automatically delete completed reminders 30 days after their completion timestamp to prevent unbounded storage growth.
- **FR-016**: System MUST keep reminders in "pending" status when their scheduled time passes without a notification being delivered (e.g., notifications denied), displaying them as "overdue" in the popup dashboard with a visual distinction from upcoming reminders.
- **FR-017**: System MUST use the Chrome Alarms API to schedule reminder notifications, ensuring alarms persist across service worker restarts and extension updates.

### Key Entities

- **Reminder**: Represents a single follow-up intention. Key attributes: unique identifier, associated chat identifier, contact/chat display name, scheduled reminder time, creation timestamp, current status (pending, completed), completion timestamp (set when marked complete). A reminder belongs to exactly one chat and transitions from pending to completed (or is deleted). Completed reminders are automatically purged 30 days after completion.
- **Chat Reference**: A lightweight reference to a WhatsApp Web conversation. Key attributes: chat identifier (phone number or JID extracted from WhatsApp Web's internal data or URL, chosen for stability across DOM changes and sessions), display name of the contact or group. Used to associate a reminder with a specific conversation and to navigate back to it.
- **User Plan**: Tracks the user's subscription tier. Key attributes: plan type (free or paid), active reminder count against plan limit. Determines whether reminder creation is permitted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a reminder from any WhatsApp Web chat in 3 clicks or fewer and under 10 seconds total interaction time.
- **SC-002**: 95% of due reminders result in a visible desktop notification within 60 seconds of the scheduled time.
- **SC-003**: System supports at least 10,000 stored reminders per user without perceptible lag when opening the popup dashboard.
- **SC-004**: The popup dashboard renders its initial view in under 100 milliseconds from the moment the user clicks the extension icon (aligned with Constitution IV performance gate).
- **SC-005**: 90% of first-time users successfully create and receive their first reminder without external help or documentation.
- **SC-006**: Clicking a notification opens the correct WhatsApp Web chat within 3 seconds.
- **SC-007**: Zero reminders are lost due to browser restarts, extension updates, or normal Chrome storage operations.
- **SC-008**: The extension adds no more than 100ms to WhatsApp Web's page load time as perceived by the user.
- **SC-009**: Daily active users reach 500 within 3 months of Chrome Web Store launch.
- **SC-010**: Reminder completion rate (reminders acted upon vs. reminders created) exceeds 60% across all active users.

## Assumptions

- Users access WhatsApp Web through Google Chrome on desktop (Windows, macOS, or Linux). Other Chromium-based browsers (Edge, Brave) are expected to work but are not primary targets for MVP.
- WhatsApp Web's chat header DOM structure is stable enough to inject a button reliably. The extension will use robust, scoped CSS selectors and a MutationObserver to handle dynamic DOM changes. Chat identifiers are derived from WhatsApp Web's internal data (phone number or JID) rather than DOM-positional attributes, ensuring stability across sessions and updates.
- "Tonight" defaults to 8:00 PM and "Tomorrow" defaults to 9:00 AM in the user's local timezone. These defaults cover the most common business follow-up patterns.
- The free plan limit of 5 active reminders is sufficient to demonstrate value and motivate upgrades. "Active" means reminders with status "pending" — completed and deleted reminders do not count against the limit.
- Chrome's local storage is the persistence layer for MVP. Migration to a cloud backend (e.g., Supabase) is a future concern and does not affect this specification.
- The Chrome Alarms API is the scheduling mechanism for reminder notifications. Its 1-minute minimum granularity aligns with the 60-second notification tolerance (SC-002). Alarms persist across service worker restarts and extension updates, satisfying the data durability edge case.
- Required Chrome extension permissions: `alarms`, `storage`, `notifications`. Host permission: `*://web.whatsapp.com/*`. The `activeTab` permission is not needed — the explicit host permission provides programmatic tab access required for notification click-through navigation (FR-006, FR-014).
- Users grant notification permissions when prompted by the browser. If they decline, the extension will still function for creating and managing reminders, but notifications will not fire — a visual indicator in the popup will alert them to enable notifications. Reminders whose scheduled time passes without notification will remain pending and appear as "overdue" in the dashboard.

## Clarifications

### Session 2026-02-15

- Q: What happens to completed reminders over time? → A: Auto-delete completed reminders after 30 days.
- Q: What happens to reminders when notification permissions are denied and the scheduled time passes? → A: Reminders stay pending, shown as "overdue" in dashboard.
- Q: How should the chat identifier be derived for stability across sessions? → A: Use phone number / JID from WhatsApp Web's internal data or URL.
- Q: What scheduling mechanism should be used for reminder notifications in MV3? → A: Chrome Alarms API (1-minute granularity, persists across service worker restarts).
- Q: What Chrome permissions should the extension declare? → A: `alarms`, `storage`, `notifications`, host permission `*://web.whatsapp.com/*` (no `activeTab`).
