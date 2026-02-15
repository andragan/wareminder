# Storage Service Contract

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15

Defines the internal API surface for `src/services/storage-service.js`. All storage operations go through this service.

---

## Interface

### `getReminders() → Promise<Reminder[]>`

Returns all reminders from storage. Returns empty array if none exist.

```javascript
const reminders = await StorageService.getReminders();
// → [{ id, chatId, chatName, scheduledTime, createdAt, status, completedAt }, ...]
```

### `saveReminders(reminders: Reminder[]) → Promise<void>`

Overwrites the entire reminders array in storage. Used exclusively by the service worker.

```javascript
await StorageService.saveReminders(updatedReminders);
```

### `getUserPlan() → Promise<UserPlan>`

Returns the user's plan. Returns default free plan if not set.

```javascript
const plan = await StorageService.getUserPlan();
// → { planType: "free", activeReminderLimit: 5 }
```

### `saveUserPlan(plan: UserPlan) → Promise<void>`

Saves the user's plan to storage.

```javascript
await StorageService.saveUserPlan({ planType: "free", activeReminderLimit: 5 });
```

### `onRemindersChanged(callback: (reminders: Reminder[]) → void) → void`

Registers a listener for storage changes to the `reminders` key. Fires when any context modifies reminders.

```javascript
StorageService.onRemindersChanged((reminders) => {
  updateBadge(reminders);
});
```

---

## Reminder Service Contract

Defines the internal API surface for `src/services/reminder-service.js`. Orchestrates CRUD operations, validation, and alarm management.

### `createReminder(payload: CreatePayload) → Promise<Reminder>`

Validates input, checks plan limits, creates reminder, schedules alarm.

**Throws**: `ValidationError` (invalid time, missing fields), `PlanLimitError` (at limit)

### `completeReminder(reminderId: string) → Promise<Reminder>`

Marks reminder as completed, sets `completedAt`, clears alarm.

**Throws**: `NotFoundError`, `AlreadyCompletedError`

### `deleteReminder(reminderId: string) → Promise<string>`

Removes reminder from storage, clears alarm. Returns deleted ID.

**Throws**: `NotFoundError`

### `getAllReminders() → Promise<ReminderListResponse>`

Returns sorted reminders with plan context.

### `getOverdueReminders() → Promise<Reminder[]>`

Returns pending reminders past their scheduled time.

### `cleanupExpiredCompleted() → Promise<number>`

Removes completed reminders older than 30 days. Returns count removed.

---

## Plan Service Contract

Defines the internal API surface for `src/services/plan-service.js`.

### `canCreateReminder() → Promise<boolean>`

Returns whether the user can create a new reminder based on their plan limit and current pending count.

### `getPlanStatus() → Promise<PlanStatus>`

Returns plan type, limit, current count, and availability.

```javascript
const status = await PlanService.getPlanStatus();
// → { planType: "free", activeReminderLimit: 5, currentPendingCount: 3, canCreateReminder: true }
```

---

## Chat Service Contract

Defines the internal API surface for `src/services/chat-service.js`.

### `navigateToChat(chatId: string) → Promise<void>`

Finds existing WhatsApp Web tab and navigates to the given chat, or opens a new tab.

```javascript
await ChatService.navigateToChat("5511999999999@c.us");
```

**Behavior**:
1. Query for existing tabs matching `https://web.whatsapp.com/*`
2. If found: update tab URL to `https://web.whatsapp.com/send?phone=<number>`, focus tab and window
3. If not found: create new tab with the chat URL

### `extractChatContext() → { chatId: string, chatName: string } | null`

*(Content script only)* Extracts the current chat's identifier and display name from WhatsApp Web's DOM.

Returns `null` if no chat is currently open or if extraction fails.
