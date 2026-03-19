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

## Test Lane Architecture

WAReminder uses **two independent test lanes** with distinct tools and directories. Choose based on what you're testing:

### Browser Tests (Playwright)

**Directory:** `tests/browser/`  
**File pattern:** `*.spec.js`  
**Run:** `npm run test:browser` or `npm run test:browser:headed`  
**Tool:** Playwright  
**Purpose:** Test extension UI in a real browser environment

**When to use:**
- Testing popup.html interactions (clicks, form submissions, state rendering)
- Verifying user-facing flows (upgrade prompt, reminder list, delete dialog)
- Testing content script injection and DOM manipulation
- Exercising chrome.tabs.create, chrome.runtime.sendMessage in-browser

**Strategy:** Mock window.chrome via `addInitScript()` before loading extension HTML, then call exposed extension functions to trigger state changes and verify DOM updates.

See: `~/.copilot/skills/playwright-extension-testing/` for detailed pattern

### Integration Tests (Jest)

**Directory:** `tests/integration/` and `tests/unit/`  
**File pattern:** `*.test.js`  
**Run:** `npm test`  
**Tool:** Jest + jest-chrome  
**Purpose:** Test services, business logic, and Chrome API interactions

**When to use:**
- Testing ReminderService, StorageService, AccountService, etc.
- Verifying alarm scheduling, badge updates, storage writes
- Testing notification handler logic
- Mocking Chrome APIs at the service layer

**Strategy:** Inject mock Chrome APIs via jest-chrome, pass mocks as dependencies to services, verify behavior and side effects.

### Key Differences

| Aspect | Browser (Playwright) | Integration (Jest) |
|--------|----------------------|-------------------|
| **Loads** | Real HTML + real popup.js | Service code only |
| **Chrome mocking** | window.chrome via addInitScript() | Jest mocks + jest-chrome |
| **DOM testing** | Actual browser rendering | jsdom if real HTML loaded |
| **Async handling** | page.waitForTimeout(), page.reload() | Promises, jest.fn() callbacks |
| **Side effects** | Track window.__tabsCreated, etc. | Jest mocks (chrome.tabs.create) |
| **Speed** | Slower (real browser) | Fast (node process) |

### Migration Path: Jest e2e → Playwright

When migrating a Jest e2e test to Playwright browser test:

1. Identify what the test verifies: UI behavior? Service logic?
   - UI behavior → Migrate to Playwright browser test
   - Service logic → Keep or move to integration test
   
2. Extract the mock setup (chrome.runtime.sendMessage, etc.) → Convert to Playwright addInitScript()
3. Replace jsdom HTML loading → Use file:// URL to real popup.html
4. Replace simulate functions → Call exposed window.WAReminder.popup functions
5. Replace jest.fn() assertions → Replace with Playwright locator expectations
6. Rename `.test.js` → `.spec.js` and move to `tests/browser/`

Example: `tests/e2e/upgrade-flow.test.js` (Jest) → `tests/browser/upgrade-flow.spec.js` (Playwright)

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

// For ReminderService: use AccountService (not PlanService)
// ReminderService uses AccountService.enforceReminderLimit() internally
const mockAccount = {
  enforceReminderLimit: jest.fn(async (userId, count) => ({
    allowed: true,
    limit: 5,
  })),
  getUserPlan: jest.fn(async () => 'free'),
  getReminderLimit: jest.fn(async () => 5),
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

#### E2E Test Structure: Critical Rules

**Rule 1: Import Constants from `constants.js`, Not UI Files**

UI files like popup.js use IIFE pattern and don't export constants.

```javascript
// ✅ Correct: Import from constants module
import { MESSAGE_TYPES, REMINDER_STATUS } from '../../src/lib/constants.js';

// ❌ Incorrect: UI files don't export these
import { MESSAGE_TYPES } from '../../src/popup/popup.js';
```

**Rule 2: Only Assert on Functions Actually Invoked by Test**

E2E tests verify DOM state and user interactions, not message passing internals.

```javascript
// ❌ Incorrect: Asserting on mocks that test never calls
const mockGetMessage = jest.fn(() => 'Upgrade Now');
chrome.i18n.getMessage = mockGetMessage;

// Test just manipulates DOM, doesn't call getMessage
document.getElementById('upgrade-btn').textContent = 'Upgrade Now';

expect(mockGetMessage).toHaveBeenCalled(); // False assertion - test didn't invoke it

// ✅ Correct: Test what actually happens
const button = document.getElementById('upgrade-btn');
expect(button.textContent).toBe('Upgrade Now'); // Test DOM state only
```

**Rule 3: Keep Mock Implementations Simple to Avoid Recursion**

Overly nested mocks with `mockImplementation` chains cause stack overflows.

```javascript
// ❌ Incorrect: Nested mock causing recursion
const handleClick = jest.fn();
element.addEventListener = jest.fn((event, handler) => {
  handleClick.mockImplementation(handler); // Nesting creates recursion
});

// ✅ Correct: Simple invocation
const handleClick = jest.fn();
element.addEventListener = jest.fn((event, handler) => {
  if (event === 'click') {
    handleClick(); // Just call it
  }
});

// Or even simpler: mock the click directly
element.addEventListener = jest.fn();
element.click = jest.fn(() => handleClick());
```

### Integration Tests (Chrome API Interactions)

Mock Chrome APIs at the top level:

```javascript
beforeEach(() => {
  chrome.runtime.sendMessage = jest.fn((message, callback) => {
    setImmediate(() => callback({ success: true, data: mockData }));
  });
  
  // MV3 pattern: chrome.storage.local.get returns a Promise in app code
  chrome.storage.local.get = jest.fn(() =>
    Promise.resolve({ reminders: mockReminders })
  );
});
```

### Critical MV3 Pattern: Promise-Based Storage Mocking

WAReminder production code uses `await chrome.storage.local.get(...)`. Tests must mock storage with Promise-returning implementations.

```javascript
// ✅ Correct: Promise-based mock for await usage
chrome.storage.local.get.mockImplementation(() =>
  Promise.resolve({ subscriptionStatus: mockSubscriptionStatus })
);

// ❌ Incorrect: callback-style mock when production code awaits Promise
chrome.storage.local.get.mockImplementation((keys, callback) => {
  callback({ subscriptionStatus: mockSubscriptionStatus });
});
```

### Choosing `mockImplementation()` vs `mockImplementationOnce()`

Choose based on expected call frequency in the function under test.

- Use `mockImplementationOnce()` when the API is called exactly once in that test path.
- Use `mockImplementation()` when the API may be called multiple times (directly or through nested service calls).
- In WAReminder, this is critical for service methods that call helper methods repeatedly; for example, if one method triggers `getReminderLimit()` twice and each call performs `chrome.storage.local.get()`, a one-time mock will fail on later calls.

```javascript
// Multi-call path: mock all invocations
chrome.storage.local.get.mockImplementation(() =>
  Promise.resolve({ subscriptionStatus: mockSubscriptionStatus })
);

// Single-call path: one-time mock is appropriate
chrome.storage.local.get.mockImplementationOnce(() =>
  Promise.resolve({ subscriptionStatus: mockSubscriptionStatus })
);
```

### Payment Service Testing Patterns

Payment services require special mocking patterns for fetch(), Chrome APIs, and authentication tokens.

#### Mock Setup: All Required Chrome APIs

Payment services depend on multiple Chrome APIs simultaneously. Mock all of them in test setup:

```javascript
// Complete Chrome API mock for payment-service tests
global.chrome = {
  tabs: {
    create: jest.fn(),  // Opens checkout/portal URLs
  },
  identity: {
    getAuthToken: jest.fn((opts, cb) => {
      setTimeout(() => cb('mock-token-123'), 10);  // Async callback pattern
    }),
  },
  runtime: {
    lastError: null,  // Required for error checking
    onMessage: {
      addListener: jest.fn(),  // Listens for payment webhooks
    },
  },
  storage: {
    local: {
      set: jest.fn((obj, cb) => cb?.()),  // Updates subscription cache
      get: jest.fn((keys, cb) => cb({})),
    },
  },
};

// Environment variables must match what production code checks
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
```

#### Mocking fetch() for Payment Responses

Payment flows expect specific response shapes. Match the backend contract exactly:

```javascript
describe('initiateCheckout', () => {
  it('should create checkout session and open tab', async () => {
    const mockSessionUrl = 'https://checkout.stripe.com/pay/cs_test_123';

    // Mock fetch with expected response shape
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        sessionUrl: mockSessionUrl  // Note: sessionUrl, not invoiceUrl
      }),
    });

    const result = await paymentService.initiateCheckout('user-123');

    expect(result).toBe(mockSessionUrl);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: mockSessionUrl });
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,  // Backend error
    });

    const result = await paymentService.initiateCheckout('user-123');
    expect(result).toBeNull();  // Service should return null, not throw
  });
});
```

#### Portal Access Pattern

Customer portal follows similar pattern but returns `portalUrl`:

```javascript
describe('redirectToCustomerPortal', () => {
  it('should open customer portal in new tab', async () => {
    const mockPortalUrl = 'https://billing.stripe.com/portal/session/test';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ portalUrl: mockPortalUrl }),
    });

    const result = await paymentService.redirectToCustomerPortal('user-123');

    expect(result).toBe(true);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: mockPortalUrl });
  });
});
```

#### Payment Success Verification

`handleCheckoutSuccess()` updates local cache after payment:

```javascript
describe('handleCheckoutSuccess', () => {
  it('should verify session and update cache', async () => {
    const mockTrialEndDate = '2026-03-13T00:00:00Z';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trial_end_date: mockTrialEndDate }),
    });

    const result = await paymentService.handleCheckoutSuccess('user-123', 'session-123');

    expect(result).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: expect.objectContaining({
          plan_type: 'premium',
          status: 'trial',
        }),
      }),
      expect.any(Function)  // Callback parameter
    );
  });
});
```

#### Environment Variable Validation

Test configuration checks to ensure production code can detect missing keys:

```javascript
describe('isStripeConfigured', () => {
  it('should return false when Stripe key is not set', () => {
    delete process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    expect(paymentService.isStripeConfigured()).toBe(false);
  });

  it('should return true when Stripe key is configured', () => {
    process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    expect(paymentService.isStripeConfigured()).toBe(true);
  });
});
```

#### Key Learnings for Payment Tests

1. **Response shapes matter**: Backend returns `sessionUrl` (not `invoiceUrl`), `portalUrl`, and `trial_end_date` fields
2. **Auth token is async**: `chrome.identity.getAuthToken()` uses callback pattern—mock with `setTimeout` to simulate async behavior
3. **Mock all Chrome APIs**: Payment flows touch tabs, identity, storage, and runtime—forget one and tests fail silently
4. **Environment variables**: Production code checks `REACT_APP_STRIPE_PUBLISHABLE_KEY`—set this in test setup even if migrated to Xendit
5. **Error handling is silent**: Payment methods return `null` or `false` on error, not throw exceptions

## Anti-Patterns

**Don't:**
- Mock HTML with hardcoded strings when real file exists
- Try to execute full popup.js/content scripts in test environment
- Test implementation details over behavior
- Skip jsdom polyfills (TextEncoder, etc.) when using JSDOM
- Forget to wait for async operations
- Use callback-based `chrome.storage.local.get` mocks when production code uses `await`
- Use `mockImplementationOnce()` for code paths that call the same mocked API multiple times
- Import constants from UI files (popup.js, etc.) that use IIFE pattern
- Assert that mocked functions were called when test never invokes them
- Create nested mock implementations with `mockImplementation` chains (causes recursion)
- Forget to mock all Chrome APIs that payment services depend on (tabs, identity, storage, runtime)
- Use hardcoded response field names without checking backend contract (e.g., assume `invoiceUrl` when backend returns `sessionUrl`)
- Forget to set environment variables that production code checks (`REACT_APP_STRIPE_PUBLISHABLE_KEY`, etc.)
- Expect payment methods to throw errors—they return `null` or `false` instead

**Instead:**
- Load real HTML files
- Simulate extracted logic
- Test user-observable outcomes
- Add required polyfills in setup
- Use `await` and `setTimeout` helpers
- Return Promises from Chrome storage mocks and match mock strategy to call count
- Import constants from `src/lib/constants.js` where they're properly exported
- Only assert on functions that your test code actually calls
- Keep mocks simple - directly invoke handlers rather than chaining implementations
- Mock complete Chrome API surface area that service uses—check service implementation for all dependencies
- Verify backend response schemas match what tests mock (sessionUrl, portalUrl, trial_end_date)
- Set all environment variables in test setup that production configuration checks
- Test return values (`null`, `false`) rather than expect exceptions from payment flows

## Running Tests

```bash
npm test                           # Jest (integration + unit) with coverage
npm run test:watch                 # Jest watch mode
npm run test:browser               # Playwright browser tests (headless)
npm run test:browser:headed        # Playwright browser tests (visible browser)
npm test -- path/to/test           # Single Jest file
npm test -- --testNamePattern="*"  # Specific Jest tests
```

## Coverage Requirements

- 80% statement coverage for `src/lib/**` and `src/services/**`
- Enforced via jest.config.js
- Check coverage report: `coverage/lcov-report/index.html`

## References

- [jest.setup.js](../../jest.setup.js) - Jest configuration with jest-chrome
- [jest.config.js](../../jest.config.js) - Jest test discovery and coverage settings
- [playwright.config.js](../../playwright.config.js) - Playwright browser test configuration
- [tests/integration/badge-count.test.js](../../tests/integration/badge-count.test.js) - Integration test example (service + Chrome API mocks)
- [tests/browser/upgrade-flow.spec.js](../../tests/browser/upgrade-flow.spec.js) - Playwright browser test example
- [tests/browser/extension-load.spec.js](../../tests/browser/extension-load.spec.js) - Playwright manifest validation test
- [tests/unit/services/payment-service.test.js](../../tests/unit/services/payment-service.test.js) - Unit test example with fetch() and Chrome API mocks
- [~/.copilot/skills/playwright-extension-testing/SKILL.md](~/.copilot/skills/playwright-extension-testing/SKILL.md) - Global skill for Playwright Chrome extension testing patterns
