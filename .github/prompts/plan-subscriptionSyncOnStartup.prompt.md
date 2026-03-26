# Plan: Wire Up Subscription Sync on Startup

The extension never fetches subscription state on startup and never stores the `userId` locally, making the `INITIATE_CHECKOUT` fallback path permanently broken. This plan fixes both issues in five independently completable steps.

---

## Step 1 — Add `"identity"` permission to manifest.json

- Add `"identity"` to the `permissions` array in `src/manifest.json`
- Without this, `chrome.identity.getAuthToken()` silently fails in all contexts

**Verify:** Load the unpacked extension in Chrome, open DevTools for the service worker, confirm no `chrome.identity is not defined` errors.

---

## Step 2 — Implement `getCurrentUserId()` in subscription-sync.js

- Replace the stub in `src/background/subscription-sync.js` (line 274) with a real implementation
- Call `chrome.identity.getAuthToken({ interactive: false })` — non-interactive, no popup
- Decode the returned JWT to extract the `sub` claim (user ID) using `atob()` on the base64url payload segment — no library needed
- Return `null` if no token or token lacks a `sub` claim (unauthenticated user)

**Verify:** Add a temporary `console.log` in `performSync()` to confirm `userId` is non-null after the change.

---

## Step 3 — Persist `userId` in the subscription cache

- In `src/services/account-service.js`, update `syncSubscriptionFromBackend(userId)` to include `userId` in the object written to `subscriptionStatus` storage
- This makes `StorageService.getSubscriptionStatus()` return `{ ..., userId: "..." }` — which is what the `INITIATE_CHECKOUT` handler expects

**Verify:** After a sync, open `chrome.storage.local` in DevTools and confirm `subscriptionStatus.userId` is populated.

---

## Step 4 — Wire up `subscriptionSync.initialize()` on startup

- In `src/background/service-worker.js`, import `{ initialize as initSubscriptionSync }` from `./subscription-sync.js`
- Call `await initSubscriptionSync()` in the startup IIFE (after `reconcileAlarms`)
- Wrap in try/catch so a sync failure doesn't break other startup tasks (alarm reconciliation, badge update, etc.)

**Verify:** On extension reload, confirm the service worker console logs the sync messages from `subscription-sync.js`.

---

## Step 5 — Fix the `INITIATE_CHECKOUT` handler error message

- After steps 3 and 4, signed-in users will have `subscription.userId` populated, so the happy path now works
- The only remaining case where `resolvedUserId` is null is a genuinely unauthenticated user — clarify the error message from `"Unable to determine user ID for checkout"` to `"Please sign in to your Google account to upgrade"`
- Remove the `subscription?.userId` optional chaining — after step 3, `subscription` being null is the only possible null case, so check that explicitly with a clear error

**Verify:** Test with a signed-in user (checkout initiates), and confirm the error message makes sense for an unauthenticated user.

---

## Relevant files

- `src/manifest.json` — add `"identity"` permission
- `src/background/subscription-sync.js` — implement `getCurrentUserId()`
- `src/services/account-service.js` — persist `userId` in `syncSubscriptionFromBackend`
- `src/background/service-worker.js` — import and call `initSubscriptionSync()` in IIFE; clean up `INITIATE_CHECKOUT` handler

## Decisions

- Non-interactive `getAuthToken` only — no popup is ever shown
- JWT decoded manually with `atob()` — no library dependency
- If sync fails on startup, it fails silently (try/catch) — the user stays on the cached plan until next sync
- No backend changes required — `create-xendit-invoice` continues to receive `userId` in the request body
