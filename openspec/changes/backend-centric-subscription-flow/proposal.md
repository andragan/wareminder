## Why

The current subscription and authentication model still has the same critical flaw at its center: WAReminder does not have a single, authoritative identity and session system.

1. **Inconsistent authentication contracts** — the extension obtains a Google token via `chrome.identity.getAuthToken()`, but one backend path still expects a Supabase JWT while another validates the Google token directly. This creates a trust model that is hard to reason about and easy to break.
2. **Custom auth surface area** — user identity is currently inferred in edge functions instead of being owned by Supabase Auth. That means session issuance, session restoration, and auth recovery are being approximated in extension code instead of delegated to the platform.
3. **Abandoned `auth.users` model** — the schema originally referenced `auth.users`, but migration 006 removed that linkage. As a result, the project lost the clean user model and RLS foundation it was initially designed around.
4. **Bypassable frontend enforcement** — premium entitlements and reminder limits still lean on locally cached state, which can be edited in `chrome.storage.local`.
5. **Stub and hybrid flows** — several subscription flows are placeholders, and the popup has to infer whether auth failed, premium is missing, or the backend contract changed.

## What Changes

- **Adopt Supabase Auth as the sole user-facing authentication system** for the extension, using Google as the sign-in provider managed by Supabase
- **Replace the current Chrome Identity token flow** with a Supabase-owned OAuth/session flow suitable for a Chrome extension
- **Make `auth.users.id` the canonical user identifier** for subscriptions and app-level user data
- **Restore a clean profile model** so `user_profiles` is keyed from or directly linked to `auth.users`, instead of acting as a parallel identity system
- **Require Supabase JWTs for all user-facing edge functions** (`get-subscription-status`, `create-paddle-checkout`, `check-reminder-limit`, portal flows)
- **Move session persistence and refresh into a central extension auth/session layer** backed by `chrome.storage.local`
- **Keep plan derivation in `subscriptions` only** and make backend plan enforcement authoritative
- **Reintroduce meaningful user-scoped authorization** by aligning the backend with Supabase Auth instead of custom Google-token validation

## Capabilities

### New Capabilities
- `supabase-auth-session`: Extension sign-in, session persistence, refresh, and sign-out through Supabase Auth
- `backend-plan-enforcement`: Reminder limit checks performed server-side for the authenticated Supabase user
- `subscription-state-endpoint`: Subscription status and checkout endpoints keyed off the authenticated Supabase user

### Modified Capabilities
- `popup-subscription-state`: Popup auth and premium-state behavior updated to rely on Supabase session state and JWT-backed subscription refreshes

## Impact

- **Database**: Migrations to restore `auth.users` as the canonical identity anchor, remove redundant profile plan state, and realign subscriptions to authenticated users
- **Supabase Auth**: Google provider configuration, Chrome-extension-compatible redirect flow, session lifecycle support
- **Supabase edge functions**: User-facing endpoints updated to require Supabase JWTs and authenticated user resolution instead of custom Google token handling
- **Extension services**: `account-service.js`, `subscription-service.js`, `plan-service.js`, `storage-service.js`, and service-worker auth/session orchestration rewritten around Supabase sessions
- **Extension popup**: Sign-in, session restore, premium refresh, and auth recovery flows updated to use Supabase session state
- **Tests**: Playwright coverage updated for Supabase sign-in, session restore/refresh, premium state, and backend enforcement
