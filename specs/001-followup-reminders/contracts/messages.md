# Message Passing Contract: Content Script ↔ Service Worker

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15

All communication between the content script (or popup) and the service worker uses `chrome.runtime.sendMessage()` with typed action messages. The service worker is the sole handler.

---

## Message Format

All messages follow a typed action pattern:

```typescript
// Request (sent by content script or popup)
interface Message {
  type: string;       // Action identifier (SCREAMING_SNAKE_CASE)
  payload?: object;   // Action-specific data
}

// Response (returned by service worker)
interface Response {
  success: boolean;
  data?: object;      // Action-specific result data
  error?: string;     // Human-readable error message (when success === false)
}
```

---

## Actions

### CREATE_REMINDER

**Sender**: Content script  
**Spec**: FR-002, FR-003, FR-004, FR-009

Creates a new reminder and schedules a Chrome alarm.

**Request**:
```json
{
  "type": "CREATE_REMINDER",
  "payload": {
    "chatId": "5511999999999@c.us",
    "chatName": "John Doe",
    "scheduledTime": 1739836800000
  }
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `chatId` | `string` | Yes | Must match `\d+@(c\.us\|g\.us)` |
| `chatName` | `string` | Yes | Non-empty after trim |
| `scheduledTime` | `number` | Yes | Must be > `Date.now()` |

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "chatId": "5511999999999@c.us",
      "chatName": "John Doe",
      "scheduledTime": 1739836800000,
      "createdAt": 1739750400000,
      "status": "pending",
      "completedAt": null
    }
  }
}
```

**Error Responses**:

| Error | Condition | Message |
|---|---|---|
| `INVALID_TIME` | `scheduledTime <= Date.now()` | `"Reminder time must be in the future"` |
| `PLAN_LIMIT_REACHED` | Pending count >= plan limit | `"You've reached the limit of {limit} active reminders. Upgrade to create more."` |
| `INVALID_CHAT_ID` | `chatId` doesn't match JID pattern | `"Invalid chat identifier"` |
| `MISSING_FIELDS` | Required field empty/null | `"Missing required field: {field}"` |
| `STORAGE_ERROR` | Chrome storage write failure | `"Failed to save reminder. Please try again."` |

---

### COMPLETE_REMINDER

**Sender**: Popup  
**Spec**: FR-007 (acceptance scenario 3)

Marks a reminder as completed. Sets `completedAt` and clears the associated alarm.

**Request**:
```json
{
  "type": "COMPLETE_REMINDER",
  "payload": {
    "reminderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `reminderId` | `string` | Yes | Must exist in storage |

**Success Response**:
```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "completedAt": 1739923200000
    }
  }
}
```

**Error Responses**:

| Error | Condition | Message |
|---|---|---|
| `NOT_FOUND` | No reminder with given ID | `"Reminder not found"` |
| `ALREADY_COMPLETED` | Status already `"completed"` | `"Reminder is already completed"` |

---

### DELETE_REMINDER

**Sender**: Popup  
**Spec**: FR-010

Permanently removes a reminder from storage and clears the associated alarm.

**Request**:
```json
{
  "type": "DELETE_REMINDER",
  "payload": {
    "reminderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `reminderId` | `string` | Yes | Must exist in storage |

**Success Response**:
```json
{
  "success": true,
  "data": {
    "deletedId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

**Error Responses**:

| Error | Condition | Message |
|---|---|---|
| `NOT_FOUND` | No reminder with given ID | `"Reminder not found"` |

---

### GET_REMINDERS

**Sender**: Popup  
**Spec**: FR-007

Retrieves all reminders sorted by scheduled time (soonest first).

**Request**:
```json
{
  "type": "GET_REMINDERS"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "...",
        "chatId": "...",
        "chatName": "...",
        "scheduledTime": 1739836800000,
        "createdAt": 1739750400000,
        "status": "pending",
        "completedAt": null
      }
    ],
    "pendingCount": 3,
    "planLimit": 5,
    "planType": "free"
  }
}
```

**Note**: The popup can also read directly from `chrome.storage.local.get('reminders')` for initial render, then use `onChanged` for reactive updates. The `GET_REMINDERS` message provides plan context not available in raw storage.

---

### GET_PLAN_STATUS

**Sender**: Content script, Popup  
**Spec**: FR-009

Returns the user's plan type and remaining reminder capacity.

**Request**:
```json
{
  "type": "GET_PLAN_STATUS"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "planType": "free",
    "activeReminderLimit": 5,
    "currentPendingCount": 3,
    "canCreateReminder": true
  }
}
```

---

### CHECK_NOTIFICATION_PERMISSION

**Sender**: Popup  
**Spec**: Assumption (notification permissions)

Checks whether the extension has notification permission.

**Request**:
```json
{
  "type": "CHECK_NOTIFICATION_PERMISSION"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "permissionLevel": "granted"
  }
}
```

Possible `permissionLevel` values: `"granted"`, `"denied"`.

---

## Internal Service Worker Events (not messages)

These are triggered by Chrome APIs, not by message passing:

### chrome.alarms.onAlarm

**Trigger**: Chrome fires when a scheduled alarm's `when` time arrives.  
**Handler**: `alarm-handler.js`  
**Action**: Look up reminder by alarm name (`reminder-<id>`), create notification.

### chrome.notifications.onClicked

**Trigger**: User clicks a desktop notification.  
**Handler**: `notification-handler.js`  
**Action**: Navigate to WhatsApp Web chat (find existing tab or open new one).

### chrome.storage.onChanged

**Trigger**: Any context writes to `chrome.storage.local`.  
**Handler**: `service-worker.js`  
**Action**: Update badge count based on pending reminders.

### chrome.runtime.onInstalled

**Trigger**: Extension installed or updated.  
**Handler**: `service-worker.js`  
**Action**: Initialize default `userPlan`, reconcile alarms from storage, run auto-cleanup for expired completed reminders.
