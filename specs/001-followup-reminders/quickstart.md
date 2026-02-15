# Quickstart: WhatsApp Follow-Up Reminder Extension (MVP)

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15

---

## Prerequisites

- **Node.js** ≥ 18 (for build tools and testing)
- **npm** ≥ 9
- **Google Chrome** (latest stable)
- **WhatsApp Web** session (logged in at `web.whatsapp.com`)

---

## Project Setup

```bash
# Clone and checkout feature branch
git clone <repo-url> wareminder
cd wareminder
git checkout 001-followup-reminders

# Install dev dependencies (testing, linting)
npm install
```

### Key Dependencies (devDependencies only — no runtime deps)

| Package | Purpose |
|---|---|
| `jest` | Test runner |
| `jest-chrome` | Chrome API mocks for Jest |
| `jest-environment-jsdom` | DOM environment for content script tests |
| `eslint` | Linting (constitutional requirement) |
| `eslint-config-recommended` | Base ESLint config |

```bash
npm install --save-dev jest jest-chrome jest-environment-jsdom eslint
```

---

## Project Structure

```
src/
├── content/           # Injected into WhatsApp Web
│   ├── injector.js
│   ├── chat-observer.js
│   ├── reminder-prompt.js
│   └── styles.css
├── background/        # MV3 service worker
│   ├── service-worker.js
│   ├── alarm-handler.js
│   └── notification-handler.js
├── popup/             # Extension popup dashboard
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── services/          # Shared business logic
│   ├── reminder-service.js
│   ├── storage-service.js
│   ├── plan-service.js
│   └── chat-service.js
├── lib/               # Shared utilities
│   ├── constants.js
│   ├── validators.js
│   └── utils.js
├── _locales/en/messages.json
├── manifest.json
└── icons/
tests/
├── unit/
├── integration/
└── e2e/
```

---

## Development Workflow

### 1. Load the Extension in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the project's `src/` directory
5. The WAReminder icon appears in the toolbar

### 2. Make Changes

- Edit files in `src/`
- For content script or manifest changes: click the **reload** button on the extension card at `chrome://extensions/`
- For popup changes: close and reopen the popup
- For service worker changes: click "Service Worker" link on the extension card to open DevTools, then reload

### 3. Test on WhatsApp Web

1. Open `web.whatsapp.com` in Chrome
2. Open any chat
3. Verify the "Set Reminder" button appears in the chat header
4. Create a test reminder (set for 1 minute in the future)
5. Wait for the notification
6. Click the notification → verify chat opens

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/services/reminder-service.test.js

# Run in watch mode during development
npm test -- --watch
```

### Coverage Threshold (constitutional requirement: ≥80%)

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};
```

---

## Linting

```bash
# Run ESLint
npx eslint src/

# Fix auto-fixable issues
npx eslint src/ --fix
```

---

## Key Architecture Decisions

| Decision | Details |
|---|---|
| **Single writer** | Only the service worker writes to `chrome.storage.local`. Content script and popup send messages. |
| **Alarm per reminder** | Each pending reminder has a `chrome.alarms` alarm named `reminder-<id>`. |
| **Alarm reconciliation** | On every service worker startup, reconcile alarms from storage (alarms may be lost on browser restart). |
| **No framework** | Vanilla JS/HTML/CSS. Keeps bundle ≤500KB, avoids unnecessary complexity. |
| **`// @ts-check`** | All JS files use TypeScript checking via JSDoc annotations. |

---

## Smoke Test Checklist

Before submitting a PR, manually verify:

- [ ] "Set Reminder" button visible in WhatsApp Web chat header
- [ ] Reminder creation with all preset times works
- [ ] Custom date/time picker validates future time
- [ ] Notification appears at scheduled time
- [ ] Clicking notification opens correct chat
- [ ] Popup dashboard shows all reminders sorted by date
- [ ] Mark complete works (reminder moves to completed state)
- [ ] Delete works (confirmation prompt, then removal)
- [ ] Badge count updates in real time
- [ ] Empty state shows when no reminders exist
- [ ] Plan limit enforced at 5 active reminders
- [ ] Extension loads without errors in Chrome DevTools console
