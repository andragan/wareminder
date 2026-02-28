---
name: testing-patterns
description: Testing conventions and patterns for WAReminder Chrome extension. Use when writing or updating tests for UI components, services, or end-to-end workflows.
---

# Testing Patterns

Testing conventions specific to WAReminder Chrome MV3 extension.

## When to Use

- Writing new tests for popup, content scripts, or service worker
- Updating existing test files
- Debugging test failures
- Reviewing test architecture decisions

## Core Principles

**1. Test Real Structure, Simulate Complex Behavior**
- Load actual HTML files (popup.html, etc.) using jsdom
- Don't mock DOM with hardcoded strings
- When full JavaScript execution is impractical, extract and simulate key business logic
- Verify real DOM structure + test decision logic separately

**2. Dependency Injection for Services**
- All services accept optional `deps` parameter
- Tests inject mock storage/account/payment services
- Production code omits `deps` to use real implementations

**3. Single Test Responsibility**
- Each test verifies one behavior or edge case
- Group related tests in describe blocks
- Name tests descriptively: "should [expected behavior] when [condition]"

## Patterns by Test Type

### Unit Tests (Services Layer)

```javascript
// Mock dependencies via dependency injection
const mockStorage = {
  getReminders: jest.fn(() => Promise.resolve([])),
  saveReminders: jest.fn((reminders) => Promise.resolve()),
};

// Pass mocks as deps
const result = await ReminderService.createReminder(payload, {
  storage: mockStorage,
  account: mockAccount
});

// Verify behavior
expect(mockStorage.saveReminders).toHaveBeenCalledWith(
  expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })])
);
```

### E2E Tests (UI Components)

**Pattern: Load Real HTML + Simulate Logic**

When testing popup.js or other UI components:

1. Load actual HTML with jsdom (not mock strings)
2. Extract key business logic into testable helpers
3. Simulate what the real code does
4. Verify DOM state changes

```javascript
// Load real popup.html
async function createPopupContext() {
  const htmlPath = path.join(__dirname, "../../src/popup/popup.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(htmlContent, {
    url: "chrome-extension://test/popup.html",
  });
  
  return { document: dom.window.document, window: dom.window };
}

// Simulate key logic from popup.js
function simulatePopupInit(document, mockData, mockStatus) {
  // Extract and replicate the decision logic
  const element = document.getElementById('target');
  if (shouldShow(mockData, mockStatus)) {
    element.hidden = false;
  }
}

// Test
test("should show element when conditions met", async () => {
  const { document } = await createPopupContext();
  simulatePopupInit(document, testData, testStatus);
  
  const element = document.getElementById('target');
  expect(element.hidden).toBe(false);
});
```

**Why this approach:**
- Tests verify actual DOM structure exists
- Business logic is testable without full script execution
- Avoids complexity of loading all dependencies (Chrome APIs, imports, etc.)
- Changes to HTML structure caught immediately
- Logic changes require updating simulation (keeps tests honest)

### Integration Tests (Chrome API Interactions)

Mock Chrome APIs at the top level:

```javascript
beforeEach(() => {
  chrome.runtime.sendMessage = jest.fn((message, callback) => {
    setImmediate(() => callback({ success: true, data: mockData }));
  });
  
  chrome.storage.local.get = jest.fn((keys, callback) => {
    callback({ reminders: mockReminders });
  });
});
```

## Anti-Patterns

**Don't:**
- Mock HTML with hardcoded strings when real file exists
- Try to execute full popup.js/content scripts in test environment
- Test implementation details over behavior
- Skip jsdom polyfills (TextEncoder, etc.) when using JSDOM
- Forget to wait for async operations

**Instead:**
- Load real HTML files
- Simulate extracted logic
- Test user-observable outcomes
- Add required polyfills in setup
- Use `await` and `setTimeout` helpers

## Running Tests

```bash
npm test                    # Full suite with coverage
npm run test:watch          # Watch mode
npm test -- path/to/test    # Single file
npm test -- --testNamePattern="pattern"  # Specific tests
```

## Coverage Requirements

- 80% statement coverage for `src/lib/**` and `src/services/**`
- Enforced via jest.config.js
- Check coverage report: `coverage/lcov-report/index.html`

## References

- [jest.setup.js](../../jest.setup.js) - Jest configuration with jest-chrome
- [badge-count.test.js](../../tests/e2e/badge-count.test.js) - Service unit test example
- [upgrade-flow.test.js](../../tests/e2e/upgrade-flow.test.js) - UI/E2E test example
