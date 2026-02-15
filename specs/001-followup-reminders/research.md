# Research Findings: WhatsApp Follow-Up Reminder Extension (MVP)

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15 | **Plan**: [plan.md](plan.md)

---

## 1. WhatsApp Web DOM Injection Strategy

### 1.1 Stable CSS Selectors for Chat Header Injection

**Decision/Finding**: Target the chat header element using `header` element selectors scoped within WhatsApp Web's main conversation panel, specifically the right-side panel's header. WhatsApp Web uses a `header` element inside the conversation pane (the second `#pane-side` sibling). The most stable selector pattern is: `#main header` — the `#main` element wraps the active conversation, and its direct `header` child contains the contact name, avatar, and action buttons (search, menu).

**Rationale**: WhatsApp Web's class names are minified/obfuscated (e.g., `_aig5`, `_ajv5`) and change with every deployment, making class-based selectors fragile. Structural selectors based on semantic HTML elements (`header`, `#main`, `[data-tab]`, `[role]`) are significantly more stable because they rely on ARIA roles and HTML semantics that WhatsApp preserves for accessibility.

**Recommended selector strategy (ordered by stability)**:
1. `#main header` — the conversation header element
2. `[data-tab] header` — header within the tabbed pane
3. `header [role="button"]` — action buttons within the header (for positioning alongside existing buttons)
4. Injecting the "Set Reminder" button as a sibling to existing header action buttons (search icon, attach, kebab menu)

**Alternatives Considered**:
- **Obfuscated class selectors** (e.g., `._aig5`): Change on every WhatsApp Web deployment. Extremely fragile. Would require frequent extension updates.
- **XPath**: More expressive but slower and equally fragile for class-based paths. Structural XPath (e.g., `//div[@id='main']//header`) offers no benefit over CSS selectors.
- **Shadow DOM piercing**: WhatsApp Web does not use Shadow DOM — standard selectors work.

### 1.2 WhatsApp Web Chat Header Structure

**Decision/Finding**: WhatsApp Web is a React application. The chat header sits inside `#main > header` and contains:
- Contact/group avatar (left)
- Contact/group name and status/last-seen text (center)
- Action buttons row (right): voice/video call, search, attach, kebab menu

The action buttons row is a flex container. The "Set Reminder" button should be injected into this row as an additional flex child, positioned before the kebab menu for visual consistency.

**Rationale**: Injecting into the action buttons row places the button where users expect interactive controls. WhatsApp Web's React rendering replaces DOM subtrees on navigation — the injected button will be destroyed when the user switches chats, requiring re-injection via MutationObserver.

**Key structural observations**:
- WhatsApp Web uses React 18+ with frequent re-renders
- Class names are build-hash-based and change per deployment
- `data-*` attributes (like `data-tab`, `data-testid`) are more stable than class names
- The `[data-testid="conversation-header"]` or similar test IDs may exist but should be verified at implementation time

**Alternatives Considered**:
- **Injecting as a floating overlay**: Works but feels less native, violates the "matches WhatsApp's native UI" requirement (FR-001).
- **Injecting into the chat input area**: More stable DOM but wrong UX placement — reminder creation is a header-level action, not a message-level action.

### 1.3 MutationObserver Configuration

**Decision/Finding**: Use a single `MutationObserver` on `document.querySelector('#app')` (or `document.body` if `#app` isn't stable) with `{ childList: true, subtree: true }`. Filter callback mutations to detect when `#main header` appears or changes. Debounce the callback (100ms) to batch rapid DOM updates during chat transitions.

**Rationale**: 
- `subtree: true` is necessary because WhatsApp's React renders replace entire subtrees when navigating between chats. Observing only `#main` would fail because `#main` itself may be unmounted and re-mounted.
- `childList: true` catches element additions/removals. `characterData` and `attributes` are not needed for detecting navigation.
- Debouncing prevents redundant injection attempts during React's batched rendering.

**Configuration**:
```
Target: document.querySelector('#app') or document.body
Options: { childList: true, subtree: true }
Callback: debounce(100ms) → check if #main header exists and lacks our button → inject
```

**Alternatives Considered**:
- **Observing `#main` directly**: Fails when the entire conversation panel is unmounted (e.g., navigating to "no chat selected" state, then back).
- **Polling with `setInterval`**: Wasteful, introduces latency, and doesn't integrate cleanly with the DOM lifecycle. MutationObserver is the standard approach.
- **`attributes: true`**: Adds unnecessary noise. WhatsApp frequently updates attributes for animations/state, which would trigger excessive callbacks.

### 1.4 Extracting Chat Identifiers

**Decision/Finding**: Extract the chat identifier (phone number or JID) from the WhatsApp Web URL or from internal model stores accessed via `document.querySelector` patterns.

**Primary method — URL-based extraction**:
When a chat is open, WhatsApp Web doesn't always reflect the chat ID in the URL. However, the "Open Chat" URL format `https://web.whatsapp.com/send?phone=XXXXXXXXXXX` uses phone numbers.

**Secondary method — DOM/data attribute extraction**:
- Look for `[data-id]` attributes on chat list items, which contain values like `XXXXXXXXXXX@c.us` (individual) or `XXXXXXXXXXX@g.us` (group). The JID format `<phone>@c.us` is the canonical identifier.
- Inspect the `header` element for a clickable contact-info trigger that may have a data attribute.
- Extract the contact display name from the header text content as a fallback label.

**Tertiary method — Internal store access**:
WhatsApp Web exposes internal data via `window.Store` object (accessible through whatsapp-web.js patterns), but accessing internal APIs is fragile and may violate Chrome Web Store policies (remote code execution concerns). **Avoid this approach for MVP.**

**Recommended approach for MVP**:
1. Extract the display name from `#main header` text content
2. Extract the chat JID from `[data-id]` attributes on the corresponding chat list entry (left sidebar)
3. Correlate: when `#main header` is active, find the matching `.selected` or `[aria-selected="true"]` chat in the sidebar list and read its `data-id`

**Rationale**: The sidebar list item approach provides the JID reliably — WhatsApp's chat list uses `data-id` or similar attributes for virtual scrolling. This is more stable than scraping internal stores and avoids policy violations.

**Alternatives Considered**:
- **`window.Store` / internal APIs**: Powerful but fragile, undocumented, changes without notice. Risk of Chrome Web Store rejection.
- **URL parsing only**: WhatsApp Web is a SPA; the URL doesn't always contain the chat ID. Unreliable. However, we can construct navigation URLs: `https://web.whatsapp.com/send?phone=<number>` is reliable for notification click-through (FR-006, FR-014).
- **Intercepting WebSocket frames**: Overly complex, potential security/privacy concerns, and would require additional permissions.

---

## 2. Chrome Alarms API Best Practices (MV3)

### 2.1 Creating Alarms with Specific Fire Times

**Decision/Finding**: Use the `when` parameter of `chrome.alarms.create()` to schedule alarms at exact times.

```javascript
// Schedule for a specific datetime
await chrome.alarms.create('reminder-<id>', {
  when: targetDate.getTime()  // milliseconds since epoch
});
```

The `when` parameter accepts a `Date.now()`-style timestamp (milliseconds since epoch). If the `when` time is in the past, the alarm fires immediately. If `when` is less than 30 seconds in the future, Chrome may adjust it to the minimum interval.

**Rationale**: `when` is the only correct approach for one-shot alarms at a specific time. Using `delayInMinutes` requires calculating the offset from "now" and introduces drift if the service worker restarts before creating the alarm.

**Alternatives Considered**:
- **`delayInMinutes`**: Requires computing `(targetTime - Date.now()) / 60000`. Less readable, introduces rounding issues, and is semantically wrong for fixed-time scheduling.
- **`periodInMinutes` with `when`**: Only needed for recurring alarms. MVP reminders are one-shot.

### 2.2 Alarm Persistence Across Service Worker Restarts and Updates

**Decision/Finding**: Chrome alarms **persist across service worker restarts** — they are managed by the browser, not the service worker. However, **alarms may be cleared on browser restart** and **are cleared on extension uninstall**. On extension **update**, alarms survive because the extension isn't uninstalled.

**Critical pattern — re-register alarms on startup**:
```javascript
// Service worker top-level (runs on every startup)
async function reconcileAlarms() {
  const { reminders } = await chrome.storage.local.get('reminders');
  const existingAlarms = await chrome.alarms.getAll();
  const existingNames = new Set(existingAlarms.map(a => a.name));
  
  for (const reminder of reminders) {
    if (reminder.status === 'pending' && !existingNames.has(`reminder-${reminder.id}`)) {
      await chrome.alarms.create(`reminder-${reminder.id}`, { when: reminder.scheduledTime });
    }
  }
}
reconcileAlarms();
```

Also handle `chrome.runtime.onInstalled` for `'update'` reason to reconcile alarms after extension updates.

**Rationale**: The Chrome docs explicitly warn: "Alarms may be cleared upon browser restart." Storage is the source of truth; alarms are a scheduling mechanism that must be reconciled. This satisfies FR-017 and the edge case about extension updates.

**Alternatives Considered**:
- **Trusting alarms as the sole source of truth**: Dangerous. Alarms have no guaranteed persistence across browser restarts. Storage must be the canonical record.
- **Using a periodic "watchdog" alarm**: Adds complexity. The reconcile-on-startup pattern is simpler and covers all cases.

### 2.3 Maximum Number of Alarms

**Decision/Finding**: Chrome does **not document a hard maximum** on the number of alarms. However, practical testing from the community suggests Chrome handles **hundreds of alarms** without issue. Chrome's internal limit is reportedly **500 alarms per extension**, but this is not officially documented and may vary.

For the MVP with 5 active reminders (free plan) this is a non-issue. Even at scale (10,000 reminders as per SC-003), not all reminders would have concurrent alarms — only pending future reminders need alarms. Completed/overdue reminders have no alarms.

**Rationale**: The realistic alarm count will be bounded by the active reminder count, which for most users will be well under 100. The free plan cap of 5 means the vast majority of users will have ≤5 concurrent alarms.

**Alternatives Considered**:
- **Single periodic alarm + storage scan**: Create one alarm that fires every minute and checks storage for due reminders. Eliminates alarm-count concerns but introduces 1-minute latency (acceptable per SC-002) and wakes the service worker every minute unnecessarily.
- **Hybrid**: Use individual alarms up to a threshold (e.g., 100), then fall back to a periodic scan. Unnecessary complexity for MVP.

**Recommendation**: Use individual per-reminder alarms for MVP. Monitor alarm counts at scale.

### 2.4 Alarm Naming Conventions

**Decision/Finding**: Use a prefix-based naming convention: `reminder-<reminderID>`.

```javascript
// Creating
await chrome.alarms.create(`reminder-${reminder.id}`, { when: reminder.scheduledTime });

// In onAlarm handler, parse back
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('reminder-')) {
    const reminderId = alarm.name.slice('reminder-'.length);
    handleReminderDue(reminderId);
  }
});

// Deleting when reminder is cancelled
await chrome.alarms.clear(`reminder-${reminder.id}`);
```

**Rationale**: Prefixing with `reminder-` provides a namespace so the extension can add other alarm types in the future (e.g., `cleanup-`, `sync-`) without collisions. Embedding the reminder ID directly in the alarm name enables O(1) lookup without scanning storage.

**Alternatives Considered**:
- **Using just the reminder ID as the name**: Works but lacks namespacing. Future alarms (e.g., for auto-cleanup per FR-015) would need a different convention.
- **Storing alarm→reminder mapping in storage**: Unnecessary indirection. The name itself is sufficient.

### 2.5 Handling Overdue Alarms on Service Worker Startup

**Decision/Finding**: On every service worker startup (top-level code execution), scan storage for pending reminders past their scheduled time and immediately trigger notifications for any that are overdue.

```javascript
// Top-level in service-worker.js
async function checkOverdueReminders() {
  const { reminders } = await chrome.storage.local.get('reminders');
  const now = Date.now();
  const overdueReminders = reminders.filter(
    r => r.status === 'pending' && r.scheduledTime <= now
  );
  for (const reminder of overdueReminders) {
    await triggerNotification(reminder);
    // Note: keep status 'pending' (show as "overdue" in dashboard per FR-016)
  }
}
checkOverdueReminders();
```

**Rationale**: The service worker may be terminated and restarted. If an alarm fires while the worker is down, Chrome will wake the worker and fire the alarm. But if multiple alarms fire in quick succession, or the browser was closed, some may be missed. The startup scan catches these edge cases. Per FR-016, overdue reminders stay "pending" and display as "overdue" in the dashboard.

**Alternatives Considered**:
- **Relying solely on `onAlarm`**: Misses reminders if the browser was closed during the scheduled time.
- **Marking overdue reminders as "completed" automatically**: Violates FR-016 — they must remain pending and be shown as overdue.

---

## 3. Chrome Storage API Patterns

### 3.1 `chrome.storage.local` vs `chrome.storage.sync`

**Decision/Finding**: Use `chrome.storage.local` for all reminder data.

| Criteria | `storage.local` | `storage.sync` |
|---|---|---|
| **Quota** | 10MB (5MB without `unlimitedStorage` permission) | 102,400 bytes (100KB) total |
| **Per-item limit** | ~10MB | 8,192 bytes per item |
| **Max items** | No practical limit | 512 items |
| **Write rate limit** | None | 120/min, 1,800/hour |
| **Cross-device sync** | No | Yes (with Chrome sign-in) |
| **Persistence** | Until extension uninstall | Until extension uninstall, synced |

**Rationale**: 
- SC-003 requires support for 10,000 reminders. Each reminder object is roughly 200-300 bytes. 10,000 reminders ≈ 2-3MB — well within `local`'s 10MB limit but far exceeds `sync`'s 100KB quota.
- `sync`'s 512 max items and 8KB per-item limit are too restrictive if storing reminders as individual keys.
- `sync`'s write rate limits (120/min) could be hit during bulk operations.
- Cross-device sync is a future feature (master plan mentions Supabase migration). For MVP, local-only is correct.

**Alternatives Considered**:
- **`storage.sync` for settings + `storage.local` for reminders**: Viable for user preferences (e.g., default reminder time), but for MVP simplicity, use `storage.local` for everything. Settings can be migrated to `sync` later.
- **`storage.session`**: In-memory only, cleared when service worker terminates. Not suitable for persistent data. Could be used for transient UI state.
- **IndexedDB**: Available in service workers and content scripts. Better for large datasets with indexing needs. However, it's not accessible via `chrome.storage.onChanged`, which breaks the real-time badge update pattern. Overkill for MVP.

### 3.2 Storage Schema: Single Key vs Individual Keys

**Decision/Finding**: Store all reminders under a **single key** (`reminders`) as a JSON array.

```javascript
// Schema
{
  "reminders": [
    {
      "id": "uuid-1",
      "chatId": "5511999999999@c.us",
      "chatName": "John Doe",
      "scheduledTime": 1739750400000,
      "createdAt": 1739664000000,
      "status": "pending",
      "completedAt": null
    }
  ]
}
```

**Rationale**:
- **Atomic reads/writes**: A single `get('reminders')` retrieves everything needed for the popup dashboard, badge count, and alarm reconciliation. No need for multiple `get()` calls.
- **Simpler `onChanged` handling**: One key to watch. Listeners receive the complete new array, making badge count calculation trivial.
- **Simplifies CRUD**: Add/update/delete are array operations on a single object.
- At 10,000 reminders × ~250 bytes = 2.5MB — well within `storage.local`'s limit. JSON parse/stringify at this scale takes <50ms on modern hardware, satisfying the <100ms popup render target.

**Alternatives Considered**:
- **Individual keys per reminder** (e.g., `reminder-uuid-1`, `reminder-uuid-2`): Enables targeted reads/writes and avoids read-modify-write on the whole array. But requires `getAll()` or key enumeration for the dashboard, badge count, and alarm reconciliation. `onChanged` fires per-key, complicating badge updates. More complex overall.
- **Chunked arrays** (e.g., `reminders-0`, `reminders-1` for 1000 items each): Only needed if approaching the per-item size limit. With `storage.local`, no per-item limit applies. Premature optimization.

### 3.3 Concurrent Read/Write Handling

**Decision/Finding**: Implement a **read-modify-write** pattern with a **storage service abstraction** that serializes writes within each context. For cross-context coordination, rely on Chrome's internal serialization guarantees and `onChanged` listeners.

```javascript
// storage-service.js — used by all contexts
async function updateReminders(updateFn) {
  const { reminders = [] } = await chrome.storage.local.get('reminders');
  const updatedReminders = updateFn(reminders);
  await chrome.storage.local.set({ reminders: updatedReminders });
  return updatedReminders;
}
```

**Key facts about Chrome storage concurrency**:
- `chrome.storage.local.set()` is **not atomic** across contexts. If the content script and service worker both read, modify, and write simultaneously, the last writer wins (lost updates).
- In practice, write frequency is low (user-initiated actions): creating a reminder, completing a reminder, deleting a reminder. Simultaneous writes from different contexts are extremely unlikely.
- For MVP, the content script should **not write to storage directly**. It should send a message to the service worker, which performs all writes (single-writer pattern). This eliminates concurrent write races entirely.

**Architecture**:
- **Content script**: Sends `create-reminder` message to service worker via `chrome.runtime.sendMessage()`
- **Service worker**: Sole writer to storage. Handles all CRUD operations.
- **Popup**: Reads from storage for display. Sends messages to service worker for mutations (complete, delete).
- All contexts listen to `chrome.storage.onChanged` for reactive updates.

**Rationale**: The single-writer pattern is the simplest concurrency model and eliminates race conditions entirely. It's appropriate when write throughput is low (user-initiated actions only).

**Alternatives Considered**:
- **Optimistic locking with version numbers**: Add a `version` field; reject writes if the version has changed since read. Heavyweight for the use case.
- **`chrome.storage.session` as a mutex**: Session storage is ephemeral and can't reliably coordinate. Not a real mutex.
- **Direct writes from all contexts**: Technically possible but creates subtle race conditions that are hard to debug and reproduce.

### 3.4 Storage Change Listener for Badge Updates

**Decision/Finding**: Use `chrome.storage.onChanged.addListener()` in the service worker to detect reminder changes and update the badge in real time.

```javascript
// In service-worker.js
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.reminders) {
    const reminders = changes.reminders.newValue || [];
    const pendingCount = reminders.filter(r => r.status === 'pending').length;
    chrome.action.setBadgeText({ text: pendingCount > 0 ? String(pendingCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#25D366' }); // WhatsApp green
  }
});
```

**Rationale**: `onChanged` fires automatically whenever any context writes to storage. This decouples badge updates from the specific code path that modified the data. The service worker gets woken up by the storage change event, ensuring the badge is always current.

**Key details**:
- The listener fires in all contexts (service worker, popup, content script). The badge should only be set from the service worker (it owns `chrome.action`).
- `changes.reminders.newValue` contains the full new array; `changes.reminders.oldValue` contains the previous state. Both are available for delta computation if needed.
- For area-specific listening, use `chrome.storage.local.onChanged.addListener()` to avoid filtering by `areaName`.

**Alternatives Considered**:
- **Updating badge imperatively after each write**: Works but requires every code path that modifies reminders to also update the badge. Easy to miss, leading to stale badges.
- **Polling storage on a timer**: Wasteful and introduces lag. `onChanged` is event-driven and immediate.

---

## 4. Chrome Notifications API (MV3)

### 4.1 Creating Notifications with Click Handlers

**Decision/Finding**: Create notifications using `chrome.notifications.create()` with a semantically meaningful notification ID, then handle clicks via `chrome.notifications.onClicked.addListener()`.

```javascript
// Creating the notification
chrome.notifications.create(`reminder-${reminder.id}`, {
  type: 'basic',
  iconUrl: 'icons/icon-128.png',
  title: `Follow up: ${reminder.chatName}`,
  message: `Reminder to follow up with ${reminder.chatName}`,
  priority: 2,
  requireInteraction: true  // Keeps notification visible until dismissed
});

// Handling click → navigate to chat
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('reminder-')) {
    const reminderId = notificationId.slice('reminder-'.length);
    const { reminders } = await chrome.storage.local.get('reminders');
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (reminder) {
      await navigateToChat(reminder.chatId);
      chrome.notifications.clear(notificationId);
    }
  }
});
```

**Rationale**: Using the `reminder-<id>` pattern in the notification ID (matching the alarm naming convention) enables direct mapping from notification click to the specific reminder. `requireInteraction: true` ensures the notification stays visible until the user acts — critical for a follow-up tool where missing a notification defeats the purpose.

**Alternatives Considered**:
- **Notification buttons**: `chrome.notifications` supports up to 2 buttons (e.g., "Open Chat" / "Dismiss"). However, button click handlers (`onButtonClicked`) add complexity. For MVP, clicking the notification body is sufficient. Buttons can be added later.
- **Web Notifications API**: Not available in service workers in MV3. Must use `chrome.notifications`.

### 4.2 Notification Permission Flow in MV3

**Decision/Finding**: Declaring `"notifications"` in the manifest's `permissions` array **auto-grants** the extension permission to show notifications. **No user prompt is required at install time.** However, users can disable notifications for the extension via Chrome settings (`chrome://settings/content/notifications`) or via the OS notification settings after the fact.

```json
{
  "permissions": ["notifications"]
}
```

To check the current permission level:
```javascript
const level = await chrome.notifications.getPermissionLevel();
// Returns 'granted' or 'denied'
```

**Rationale**: Extension notifications are a declared permission, not a runtime permission. This differs from the Web Notifications API (`Notification.requestPermission()`), which requires user consent. The extension's `notifications` permission is shown in the Chrome Web Store listing and granted at install time.

**Handling denied state**: If the user has manually disabled notifications post-install, `getPermissionLevel()` returns `'denied'`. Per the spec's assumptions, the popup should display a visual indicator explaining that notifications are disabled and how to re-enable them. Reminders that fire without notification permission will remain pending and appear as "overdue" (FR-016).

**Alternatives Considered**:
- **Optional permissions with runtime request**: `notifications` can be declared as an optional permission and requested at runtime. This would give users a choice at the moment they first create a reminder. However, this adds friction to the core flow (first reminder creation) and is unnecessary since the permission is declared upfront.
- **Only using `optional_permissions`**: Worse UX — requires explaining to users why they need to grant the permission. The "install-time grant" is simpler and standard for this type of extension.

### 4.3 Notification Icon Requirements

**Decision/Finding**: Notification icons must be:
- **Format**: PNG, JPEG, or WebP
- **Size**: Recommended 128×128 pixels for standard displays; Chrome will scale down as needed
- **Source**: Must be a local extension resource (e.g., `icons/icon-128.png`), not a remote URL. In MV3, remote URLs in notifications are blocked.
- **Relative path**: Relative to the extension root directory

The `iconUrl` is **required** for `chrome.notifications.create()` — omitting it causes the notification to fail silently.

**Rationale**: Reuse the extension's 128px icon (`icons/icon-128.png`) for notifications. This is already required for the Chrome Web Store listing and provides visual consistency.

**Alternatives Considered**:
- **Different icons per notification type** (e.g., overdue vs. on-time): Nice to have but unnecessary for MVP. A single icon is sufficient.
- **Data URLs**: Technically possible but bloats the code — local files are simpler and more performant.

### 4.4 Handling Notification Clicks When Target Tab May Not Exist

**Decision/Finding**: Implement a tab-finding-then-navigating strategy:

```javascript
async function navigateToChat(chatId) {
  const phoneNumber = chatId.replace('@c.us', '');
  const whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}`;
  
  // 1. Try to find an existing WhatsApp Web tab
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  
  if (tabs.length > 0) {
    // 2a. Focus existing tab and navigate to chat
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true, url: whatsappUrl });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    // 2b. Open new tab
    await chrome.tabs.create({ url: whatsappUrl });
  }
}
```

**Rationale**: This handles both cases required by the spec:
- FR-006: Navigate to the correct chat when WhatsApp Web is open
- FR-014: Open a new tab when WhatsApp Web is not open

The `https://web.whatsapp.com/send?phone=<number>` URL format is WhatsApp's official deep link for opening a specific chat. It works even if the user wasn't previously chatting with that contact.

Using `chrome.tabs.query({ url: ... })` requires the `tabs` permission or host permissions. Since the manifest already declares `*://web.whatsapp.com/*` as a host permission, `chrome.tabs.query` will return matching tabs without the `tabs` permission.

**Alternatives Considered**:
- **Using `chrome.tabs.sendMessage()` to tell the content script to navigate**: Requires the content script to be loaded and listening. Fails if the tab was just opened. The URL-based approach is more reliable.
- **Opening a new tab every time**: Simple but leads to tab proliferation. Users expect reuse of the existing WhatsApp Web tab.
- **Using `window.open()` from notification click**: Not available in service workers. Must use `chrome.tabs` API.

---

## 5. Content Script ↔ Service Worker Communication

### 5.1 Message Passing Pattern

**Decision/Finding**: Use `chrome.runtime.sendMessage()` (one-shot messages) for all content script → service worker communication. Do not use long-lived connections (`chrome.runtime.connect()` / ports).

```javascript
// Content script → Service worker
const response = await chrome.runtime.sendMessage({
  type: 'CREATE_REMINDER',
  payload: {
    chatId: '5511999999999@c.us',
    chatName: 'John Doe',
    scheduledTime: 1739750400000
  }
});

if (response.success) {
  showConfirmation();
} else {
  showError(response.error);
}
```

```javascript
// Service worker listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CREATE_REMINDER') {
    handleCreateReminder(message.payload)
      .then(result => sendResponse({ success: true, reminder: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async sendResponse
  }
});
```

**Rationale**:
- Reminder operations are request-response by nature: create → success/fail, delete → success/fail. One-shot messages are the perfect fit.
- `sendMessage` returns a Promise in MV3, making the async flow clean.
- No need for a persistent connection — the content script only contacts the service worker during user-initiated actions (clicking "Set Reminder", selecting a time).
- The `return true` in the listener is critical — it tells Chrome to keep the message channel open for the async `sendResponse()` call.

**Message type convention**: Use an action-typed message format (`{ type: string, payload: object }`) for extensibility and clarity.

**Alternatives Considered**:
- **`chrome.runtime.connect()` (ports)**: Creates a long-lived bidirectional channel. Appropriate for streaming data, real-time updates, or high-frequency messages. Overkill for this use case — reminder operations are infrequent and request-response. Ports also require lifecycle management (handling disconnections, reconnections on service worker restart).
- **`chrome.storage` as a message bus**: Content script writes a "command" to storage, service worker reacts via `onChanged`. Anti-pattern — storage is for data persistence, not command dispatch. Introduces unnecessary latency and complexity.
- **`window.postMessage()`**: Only for content script ↔ web page communication. Cannot reach the service worker.

### 5.2 Content Script Requesting Reminder Creation

**Decision/Finding**: The content script gathers UI data (chat context + user's selected time) and delegates all business logic to the service worker. The content script should:
1. Extract `chatId` and `chatName` from the DOM
2. Present the time-selection UI to the user
3. Send a `CREATE_REMINDER` message with the assembled payload
4. Display success/error feedback based on the response

The service worker should:
1. Validate inputs (future time check, plan limits)
2. Generate a unique ID (UUID v4)
3. Write to storage
4. Create the alarm
5. Return the result

**Rationale**: This follows the single-writer storage pattern (Section 3.3), keeping all storage mutations in the service worker. The content script stays thin — it's a UI layer only. This separation also makes testing easier: service worker logic can be unit-tested without DOM dependencies.

**Error handling**: If the service worker is unavailable (e.g., crashed, still starting), `chrome.runtime.sendMessage()` will reject with `"Could not establish connection"`. The content script should catch this and retry once or show a user-friendly error.

---

## 6. Testing Chrome Extensions

### 6.1 Testing Framework

**Decision/Finding**: Use **Jest** with **jest-chrome** (`npm i jest-chrome -D`) for unit and integration testing.

- **jest-chrome** (v0.8.0, 69K weekly downloads, MIT license): Provides a complete mock of the `chrome` global object with all APIs typed via `@types/chrome`. Every API function is a Jest mock (`jest.fn()`), and every event has a `callListeners()` method for triggering events in tests.

**Setup**:
```javascript
// jest.config.js
module.exports = {
  setupFilesAfterSetup: ['./jest.setup.js'],
  testEnvironment: 'jsdom',  // For content script tests with DOM
};

// jest.setup.js
Object.assign(global, require('jest-chrome'));
```

**Rationale**: jest-chrome is the de facto standard for Chrome extension testing in the Jest ecosystem. It auto-generates mocks from Chrome's API schema (same source as `@types/chrome`), ensuring complete coverage of all `chrome.*` namespaces. Using Jest aligns with the plan's technical context.

**Alternatives Considered**:
- **sinon-chrome**: The older alternative. Uses Sinon stubs instead of Jest mocks. Requires bridging Sinon and Jest, adding complexity. jest-chrome is Jest-native.
- **Manual mocks**: Writing custom `chrome.*` mocks by hand. Error-prone, incomplete, and high maintenance burden as Chrome APIs evolve.
- **Vitest**: Faster than Jest, but jest-chrome doesn't officially support Vitest. Would require adapter work. Jest is battle-tested for this use case.
- **Puppeteer / Playwright**: For E2E testing of the loaded extension in a real browser. Complementary to unit tests, not a replacement. Plan notes E2E tests in `tests/e2e/` — these could use Puppeteer with extension loading.

### 6.2 Mocking `chrome.*` APIs in Unit Tests

**Decision/Finding**: jest-chrome provides three patterns for mocking `chrome.*` APIs:

**1. Events — use `callListeners()` to trigger**:
```javascript
test('handles alarm', () => {
  const handler = jest.fn();
  chrome.alarms.onAlarm.addListener(handler);
  
  chrome.alarms.onAlarm.callListeners({ name: 'reminder-123', scheduledTime: Date.now() });
  
  expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'reminder-123' }));
});
```

**2. Async functions — use `mockImplementation()` or `mockResolvedValue()`**:
```javascript
test('gets reminders from storage', async () => {
  const mockReminders = [{ id: '1', status: 'pending' }];
  chrome.storage.local.get.mockResolvedValue({ reminders: mockReminders });
  
  const { reminders } = await chrome.storage.local.get('reminders');
  expect(reminders).toEqual(mockReminders);
});
```

**3. Sync functions — use `mockReturnValue()` or `mockImplementation()`**:
```javascript
test('gets manifest', () => {
  chrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });
  expect(chrome.runtime.getManifest().version).toBe('1.0.0');
});
```

**Rationale**: jest-chrome's mock pattern aligns naturally with Jest's mocking conventions. No additional learning curve for developers familiar with Jest.

**Key testing patterns for this project**:
- **Storage service tests**: Mock `chrome.storage.local.get/set`, verify CRUD operations
- **Alarm handler tests**: Use `chrome.alarms.onAlarm.callListeners()` to simulate alarm firing, verify notification creation
- **Message handler tests**: Use `chrome.runtime.onMessage.callListeners()` to simulate content script messages, verify handler logic
- **Badge update tests**: Mock `chrome.storage.onChanged.callListeners()`, verify `chrome.action.setBadgeText` is called correctly

### 6.3 Integration Testing Content Scripts with DOM Manipulation

**Decision/Finding**: Use **Jest with jsdom** (`testEnvironment: 'jsdom'`) for content script integration tests. Construct a minimal DOM that mimics WhatsApp Web's structure, then run the content script against it.

```javascript
// content-storage.test.js
beforeEach(() => {
  // Reconstruct minimal WhatsApp Web DOM
  document.body.innerHTML = `
    <div id="app">
      <div id="main">
        <header>
          <div data-testid="conversation-header">
            <span title="John Doe">John Doe</span>
          </div>
          <div class="action-buttons">
            <!-- Existing buttons -->
          </div>
        </header>
      </div>
    </div>
  `;
});

test('injects reminder button into chat header', () => {
  // Run injector
  injectReminderButton();
  
  const button = document.querySelector('[data-testid="wa-reminder-btn"]');
  expect(button).toBeTruthy();
  expect(button.textContent).toContain('Set Reminder');
});
```

**Testing MutationObserver**: jsdom supports `MutationObserver`. Tests can:
1. Initialize the observer
2. Mutate the DOM (simulate chat navigation by replacing `#main`)
3. Flush microtasks (`await new Promise(resolve => setTimeout(resolve, 0))`)
4. Assert that the button was re-injected

**Rationale**: jsdom provides enough DOM fidelity for testing injection logic, element queries, and MutationObserver behavior. It's fast (no browser startup) and deterministic.

**Alternatives Considered**:
- **Puppeteer/Playwright loading WhatsApp Web**: Provides the real DOM structure but requires a valid WhatsApp session, is slow, flaky (depends on WhatsApp Web's CDN), and potentially violates WhatsApp's ToS if automated. Not suitable for CI/CD.
- **Happy-dom**: Faster than jsdom, but MutationObserver support is less mature. jsdom is the safer choice.
- **Testing Library (`@testing-library/dom`)**: Great for user-centric assertions. Can be used alongside jsdom for queries like `getByRole('button', { name: /set reminder/i })`. Recommended as an enhancement but not a core requirement.

---

## Summary of Key Decisions

| Topic | Decision | Key Rationale |
|---|---|---|
| DOM Injection Target | `#main header` action buttons row | Semantic selectors survive class minification |
| Chat ID Extraction | Sidebar `[data-id]` attribute (JID format) | More stable than internal APIs, avoids policy risk |
| MutationObserver | Observe `#app` / `body`, `{ childList: true, subtree: true }`, debounced | Catches full React subtree replacements |
| Alarm Scheduling | `chrome.alarms.create` with `when` parameter | Exact-time scheduling, idiomatic API usage |
| Alarm Persistence | Reconcile alarms from storage on every SW startup | Alarms may clear on browser restart |
| Alarm Naming | `reminder-<id>` prefix convention | Namespace for extensibility, O(1) ID lookup |
| Storage Area | `chrome.storage.local` | 10MB quota supports 10K reminders; sync too small |
| Storage Schema | Single `reminders` key, array of objects | Atomic reads, simple `onChanged` handling |
| Concurrency | Single-writer (service worker only) | Eliminates race conditions |
| Badge Updates | `chrome.storage.onChanged` listener in SW | Decoupled, event-driven, always current |
| Notifications | `chrome.notifications.create` with `requireInteraction` | Auto-granted permission, persistent display |
| Notification Click | Find existing WA tab → update, or create new | Satisfies FR-006 and FR-014 |
| Message Passing | `chrome.runtime.sendMessage` (one-shot) | Request-response fits; ports are overkill |
| Testing | Jest + jest-chrome + jsdom | Complete chrome mock, DOM testing, Jest-native |
