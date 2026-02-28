# AI Coding Agent Instructions for WAReminder

WAReminder is a Chrome MV3 extension that enables WhatsApp Web users to set follow-up reminders with plan-based limits (free: 5, premium: unlimited). This guide helps AI agents understand the architecture and contribute effectively.

## Architecture Overview

**Technology Stack:**
- Chrome Extension Manifest V3 (service worker + content scripts)
- Vanilla JavaScript (no frameworks)
- Jest 30 + jest-chrome for testing
- ESLint + Babel for tooling
- Supabase backend for subscriptions

**Core Components:**
1. **Service Worker** (`src/background/service-worker.js`) - Handles alarms, notifications, badge updates, message routing, and cross-component orchestration
2. **Content Scripts** (`src/content/`) - chat-observer (DOM mutation detection), reminder-prompt (UI injection), injector (initialization)
3. **Popup** (`src/popup/`) - Lists pending reminders, enables creation and completion
4. **Services Layer** (`src/services/`) - Provides testable business logic via dependency injection
5. **Storage & Constants** - Centralized data model and magic values

## Critical Architectural Patterns

### Single-Writer Pattern
All storage writes exclusively through the service worker to prevent race conditions. Content scripts and popup send messages to the service worker, which handles persistence.

**Example:** When user creates a reminder via popup:
1. Popup calls `ReminderService.createReminder()` with injected storage mock
2. Service worker's message handler processes the real write via `StorageService.saveReminders()`

### Dependency Injection for Testability
Services accept optional `deps` object containing mock implementations. Tests inject mocks; production code omits it.

```javascript
// Production: uses real StorageService
const reminder = await ReminderService.createReminder(payload);

// Test: uses mock storage
const reminder = await ReminderService.createReminder(payload, {
  storage: mockStorage,
  account: mockAccount
});
```

### Constants Centralization
All magic values (plan limits, status enums, storage keys, message types) live in [src/lib/constants.js](src/lib/constants.js). Always reference via imports, never hardcode strings.

## Major Data Flows

### Create Reminder Flow
1. Popup UI → sends `CREATE_REMINDER` message to service worker
2. Service worker calls `ReminderService.createReminder()` with real storage
3. Validates payload → checks plan limit via `AccountService` → verifies storage quota
4. Persists reminder → schedules Chrome alarm via `chrome.alarms.create()` → updates badge
5. Returns reminder object or throws error (ValidationError, PlanLimitError, StorageQuotaError)

### Notification Trigger Flow
1. Chrome alarm fires (scheduled at `reminder.scheduledTime`)
2. `alarm-handler.js` catches it, calls `ReminderService.getOverdueReminders()`
3. `notification-handler.js` creates desktop notification
4. User clicks notification → popup opens with reminder highlighted

### Plan Limit Enforcement
- `AccountService.enforceReminderLimit(userId, pendingCount)` blocks creation if user exceeds limit
- Free plan: max 5 active (pending) reminders
- Premium: unlimited
- Pending count only includes `REMINDER_STATUS.PENDING` reminders (completed/deleted excluded)

## Key Files & Modules

| File | Purpose |
|------|---------|
| [src/background/service-worker.js](src/background/service-worker.js) | Entry point; orchestrates initialization, messages, badge, alarms |
| [src/services/reminder-service.js](src/services/reminder-service.js) | CRUD operations with validation & alarm scheduling; accepts optional `deps` |
| [src/services/storage-service.js](src/services/storage-service.js) | Chrome storage abstraction; only module that directly calls `chrome.storage.local` |
| [src/services/account-service.js](src/services/account-service.js) | Plan limit enforcement; queries current pending count & subscription status |
| [src/lib/constants.js](src/lib/constants.js) | All enums, limits, storage keys, message types—required import for any business logic |
| [src/lib/validators.js](src/lib/validators.js) | Payload validation (chatId format, scheduledTime range); throws ValidationError |
| [tests/unit/services/](tests/unit/services/) | Unit tests mock Chrome alarms & storage; 80% coverage threshold enforced |
| [tests/e2e/](tests/e2e/) | End-to-end acceptance tests (badge lifecycle, subscription flow, premium enforcement) |

## Testing Strategy

**Test Patterns:**
- **Unit Tests**: Mock Chrome APIs and storage; test service logic in isolation
- **E2E Tests**: Simulate full user workflows (create → complete → delete) with mock storage
- **Setup**: [jest.setup.js](jest.setup.js) injects `jest-chrome` global; [jest.config.js](jest.config.js) enforces 80% coverage for `src/lib/**` and `src/services/**`

**Running Tests:**
```bash
npm test              # Run with coverage
npm run test:watch    # Watch mode for development
```

**Mock Storage Pattern** (from [tests/e2e/badge-count.test.js](tests/e2e/badge-count.test.js)):
```javascript
mockStorage = {
  getReminders: jest.fn(() => Promise.resolve([...storedReminders])),
  saveReminders: jest.fn((reminders) => {
    storedReminders = [...reminders];
    return Promise.resolve();
  }),
};
```

## Error Handling & Custom Error Types

Services throw explicitly named errors to distinguish failure modes:

- `ValidationError`: Invalid payload (missing fields, bad format)
- `PlanLimitError`: User exceeded active reminder limit
- `NotFoundError`: Reminder ID doesn't exist
- `AlreadyCompletedError`: Can't complete reminder twice
- `StorageQuotaError`: Chrome storage near 10MB limit

**Always check error.name in error handlers:**
```javascript
try {
  await ReminderService.createReminder(payload, deps);
} catch (err) {
  if (err.name === 'PlanLimitError') {
    // Show upgrade prompt
  } else if (err.name === 'ValidationError') {
    // Show form validation UI
  }
}
```

## Development Commands

```bash
npm test              # Jest with coverage (enforces 80% threshold)
npm run test:watch    # Watch mode
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix lint issues
```

## Subscription & Premium Features

- Free plan hardcoded to 5 active reminders (see [PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT](src/lib/constants.js))
- Premium plan checked via Supabase subscription status
- [AccountService.enforceReminderLimit()](src/services/account-service.js) syncs subscription status before allowing creation
- Trial period: 14 days (stored in `SUBSCRIPTION_CONSTANTS.TRIAL_DAYS`)

## Content Script Isolation

Content scripts cannot directly access service worker modules. Communication happens via `chrome.runtime.sendMessage()`:

```javascript
// In popup or content script
chrome.runtime.sendMessage(
  { type: MESSAGE_TYPES.CREATE_REMINDER, payload: {...} },
  (response) => { /* handle response */ }
);

// In service worker listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.CREATE_REMINDER) {
    ReminderService.createReminder(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message, name: err.name }));
  }
});
```

## Respecting User Technical Choices

When you explicitly choose or request a specific tool, approach, or technology:

1. **Follow the choice as given** — don't substitute with alternatives without explicit confirmation
2. **Don't optimize unilaterally** — even if you believe a different approach is technically superior
3. **If you have concerns**, ask first: "I suggest we try [alternative] instead because [reason]. Should we proceed differently?"
4. **Wait for confirmation** before changing course

**Example of wrong behavior:** User says "Let's use Playwright" → you decide Jest is simpler and use that instead without asking. ❌

**Example of right behavior:** User says "Let's use Playwright" → you set up Playwright as requested, even if another tool might work. ✅

This respects your technical judgment and maintains trust in the development process.

## Before Starting Work

1. **Check constants first**: Is this value in [constants.js](src/lib/constants.js)? If not, add it.
2. **Verify test coverage**: Unit test any new function in `src/services/` or `src/lib/`; run `npm test`.
3. **Use dependency injection**: Accept optional `deps` parameter in services for testability.
4. **Review error types**: Use explicit error names; check `error.name` in handlers.
5. **Avoid cross-file content script imports**: Use message passing instead.

## External Documentation

- [Master Plan](docs/MasterPlan.md) - Product requirements & success metrics
- [MV3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/) - Chrome extension APIs
- [Supabase Docs](https://supabase.com/docs) - Backend for subscriptions
