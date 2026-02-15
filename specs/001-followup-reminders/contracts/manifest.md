# Chrome Extension Manifest Contract

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15

---

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "WAReminder - WhatsApp Follow-Up Reminders",
  "version": "1.0.0",
  "description": "Set follow-up reminders on WhatsApp Web chats. Never forget to follow up with a customer again.",
  "permissions": [
    "alarms",
    "storage",
    "notifications"
  ],
  "host_permissions": [
    "*://web.whatsapp.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://web.whatsapp.com/*"],
      "js": [
        "src/content/injector.js",
        "src/content/chat-observer.js",
        "src/content/reminder-prompt.js"
      ],
      "css": ["src/content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "src/icons/icon-16.png",
      "48": "src/icons/icon-48.png",
      "128": "src/icons/icon-128.png"
    },
    "default_title": "WAReminder - View Follow-Up Reminders"
  },
  "icons": {
    "16": "src/icons/icon-16.png",
    "48": "src/icons/icon-48.png",
    "128": "src/icons/icon-128.png"
  },
  "default_locale": "en"
}
```

---

## Permission Justification

| Permission | Justification | Spec Reference |
|---|---|---|
| `alarms` | Schedule reminder notifications at specific times. Chrome Alarms API persists across service worker restarts. | FR-017 |
| `storage` | Persist reminder data across browser sessions and extension updates. | FR-004, FR-011 |
| `notifications` | Display desktop notifications when reminders are due. | FR-005 |
| `*://web.whatsapp.com/*` (host) | Inject content script for "Set Reminder" button. Query tabs to navigate to correct chat on notification click. | FR-001, FR-006, FR-014 |

## Constitution Compliance

- **No `<all_urls>`**: Host permission scoped to `*://web.whatsapp.com/*` only (Manifest Gate).
- **No remote code execution**: All scripts are local extension resources.
- **Minimal permissions**: Only 3 API permissions + 1 host permission declared.
- **No `activeTab`**: Explicit host permission provides tab access for notification click-through without `activeTab` (per spec clarifications).
