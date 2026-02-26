# Architectural Decisions: 002-Premium-Upgrade Feature

**Date**: 2026-02-27
**Feature**: Premium Upgrade Feature
**Branch**: `002-premium-upgrade`

## Decision Log

### D001: Backend Persistence Layer - Supabase ✅

**Context**: Subscription state must persist across browser clears, device changes, extension reinstalls, and multiple browsers.

**Decision**: Use Supabase PostgreSQL backend as the source of truth for subscription state.

**Rationale**:
- Local Chrome storage alone cannot survive storage permission changes or clears
- Grace period logic requires reliable server-side state machine for retry tracking and downgrade scheduling
- Needed for audit trail and payment reconciliation with Stripe webhooks
- Provides user account portability across devices
- Enables subscription state sync without user action (background jobs)

**Alternatives Considered**:
- Local-only storage: Would lose data on clear/reinstall; cannot track retry state reliably (❌ rejected)
- Firebase: Overkill complexity; Supabase equally capable and lighter weight (⚠️ reconsidered)
- Custom API: Requires infrastructure maintenance; Supabase provides managed solution (❌ rejected)

**Implications**:
- Adds Supabase client library dependency
- Requires environment configuration (URL, anon key)
- Backend authentication via JWT tokens from Supabase Auth
- All subscription queries go through Supabase REST API

**Status**: ✅ APPROVED (Plan Phase 1)

---

### D002: Payment Processing - Xendit ✅

**Context**: Extension must accept card payments for premium subscriptions without handling raw card data (PCI compliance). Must support Indonesia and global customers.

**Decision**: Use Xendit for payment processing, invoices, and customer APIs.

**Rationale**:
- Founded in Indonesia, primary market expertise with full local payment method support (GoPay, OVO, Dana, bank transfers)
- Global reach with international card support (Visa, Mastercard, Amex)
- No geographic restrictions (unlike Stripe which blocks Indonesia)
- API-first design with clean REST endpoints and webhook integration
- Built-in subscription/recurring billing support
- Webhook integration allows real-time sync of subscription state
- Test mode available for development/testing

**Alternatives Considered**:
- Stripe: Industry standard but does not support Indonesia (❌ rejected due to geo restriction)
- Midtrans: Similar to Xendit but less global reach (⚠️ considered, Xendit better globally)
- Custom payment form: Violates PCI compliance (❌ rejected)
- PayPal: Possible but less integrated with local payment methods (⚠️ considered, Xendit better for Indonesia)

**Implications**:
- Extension never sees card data (Xendit handles PCI)
- Requires Xendit API keys (Secret key + Verification Token)
- Xendit webhook endpoint required in backend
- No client-side library needed (API calls from backend only)
- Invoice-based model instead of Stripe's checkout session model

**Status**: ✅ APPROVED (Revised Post-Phase-1, replacing Stripe)

---

### D003: Trial Period Duration - 14 Days ✅

**Context**: Need to define optimal trial period for freemium conversion.

**Decision**: 14-day free trial before first billing.

**Rationale**:
- Industry standard for SaaS (sufficient time to evaluate value)
- Long enough for business users to test with real customers
- Short enough to maintain conversion momentum
- Clear expectation (2 weeks is familiar to users)
- Reminder email 2 days before first charge (day 12) allows early cancellation

**Alternatives Considered**:
- 7 days: Too short for business evaluation (❌ rejected)
- 30 days: Long enough to lose users without conversion (❌ rejected)
- 21 days: Acceptable but 14 is more standard (⚠️ reconsidered)

**Implications**:
- TRIAL_DAYS = 14 constant in code
- Trial end date tracked per subscription
- Automatic downgrade to free if not cancelled (enforced by backend)

**Status**: ✅ APPROVED (Spec Phase)

---

### D004: Grace Period for Failed Renewals - 3 Days ✅

**Context**: User's credit card declines at renewal. Must balance retention (give time to fix) with business risk (prevent unbilled usage).

**Decision**: 3-day grace period with daily retry attempts and automatic downgrade after grace period.

**Implementation**:
- Day 1: Payment failure → show warning, retain premium access
- Days 2-3: Automatic daily retry attempts
- After day 3: Auto-downgrade to free tier, notify user with recovery instructions (within 1 hour)

**Rationale**:
- Gives user time to fix payment method without losing access
- Daily retries improve conversion of failed payments
- Clear boundary prevents indefinite unpaid usage
- Automatic downgrade is non-punitive (user can reactivate if card fixed later)
- Balances UX (grace period) with business risk (enforcement)

**Alternatives Considered**:
- Immediate downgrade: Too harsh, loses users who could have fixed card (❌ rejected)
- No retry: Misses easy fixes (❌ rejected)
- 7-day grace: Too long, expensive for business (⚠️ considered, 3 days better)
- Manual recovery flow: Too high friction (❌ rejected)

**Implications**:
- New subscription statuses: `active`, `grace_period`, `cancelled`
- Backend tracks grace_period_start_date and grace_period_end_date
- Webhook handler detects invoice.payment_failed and initiates grace period
- Background sync detects grace period expiry and triggers downgrade

**Status**: ✅ APPROVED (Spec Phase)

---

### D005: Free Plan Reminder Limit - 5 Reminders ✅

**Context**: Need to establish free tier limitation to drive premium conversions.

**Decision**: Free tier limited to 5 active/pending reminders. Premium unlimited.

**Rationale**:
- 5 reminders covers most casual users' basic needs
- Forces conversion for small business users who need reliability
- Clear upgrade trigger point (simple to communicate)
- Industry standard for freemium products

**Implications**:
- Updated PLAN_LIMITS.FREE_ACTIVE_REMINDER_LIMIT from 3 → 5
- Reminder-service checks plan before allowing creation
- Account-service provides canCreateReminder(userId, currentCount) method

**Status**: ✅ APPROVED (Spec Phase)

---

### D006: Architecture - Layered Services Pattern ✅

**Context**: Need to implement subscription system without violating single responsibility and code quality standards.

**Decision**: Separate concerns into 4 services:
1. **subscription-service**: CRUD operations, state machine, grace period logic
2. **account-service**: User account state, plan type, limit enforcement
3. **payment-service**: Stripe API interactions (checkout, portal)
4. **subscription-sync**: Background job for periodic state synchronization

**Rationale**:
- Separation allows independent testing (unit tests per service)
- Each service ≤40 lines per function (code quality requirement)
- Testability via mocked Stripe/Supabase calls
- Clear responsibilities reduce debugging complexity
- Reusable services across different UIs (popup, background, future integrations)

**Implications**:
- Creates 4 new JavaScript files in src/services/
- Each service imports constants and validators
- Background service worker loads subscription-sync job on startup
- Popup UI communicates via message passing

**Status**: ✅ APPROVED (Plan Phase 1)

---

### D007: Backend - Supabase Functions for API Endpoints ✅

**Context**: Need secure API endpoints for checkout initiation, subscription queries, and webhook handling.

**Decision**: Use Supabase Edge Functions (TypeScript/Deno) for 3 endpoints:
1. `stripe-webhook-handler`: Process Stripe events
2. `create-checkout-session`: Initiate Stripe checkout
3. `get-subscription-status`: Query current subscription

**Rationale**:
- Supabase Functions provide managed serverless without additional infrastructure
- Deployed next to database (fast, no network hops)
- Built-in JWT verification from Supabase Auth
- TypeScript for type safety
- No additional cost for MVP scale

**Implications**:
- Functions use TypeScript + Deno runtime
- Stripe webhook calls supabase/functions/stripe-webhook-handler
- Extension calls backend functions via fetch() from service worker
- Backend functions verify user identity via JWT

**Status**: ✅ APPROVED (Plan Phase 1)

---

### D008: Database Schema - Separate Tables for Concerns ✅

**Context**: Need to track subscriptions, payments, and events without creating ambiguous aggregate tables.

**Decision**: 4 new PostgreSQL tables:
1. `user_profiles`: User data + plan type
2. `subscriptions`: Subscription state (created FK)
3. `payment_transactions`: Billing history
4. `subscription_events`: Immutable audit trail

**Rationale**:
- Separation enables independent scaling and compliance audits
- Subscription table tracks state machine (status, dates, grace period)
- Transactions table provides billing history for customer portal
- Events table creates immutable audit trail for disputes/audits
- RLS policies ensure users see only their own data

**Implications**:
- Migrations required (T009-T012)
- RLS policies required (T013)
- Supabase provides automatic timestamp triggers (created_at, updated_at)

**Status**: ✅ APPROVED (Plan Phase 1)

---

### D009: Local Cache Strategy - Async Background Sync ✅

**Context**: Extension popup must render fast (<100ms) without blocking on backend calls.

**Decision**: Keep subscription status in chrome.storage.local cache. Async background job syncs from Supabase every 24h or on app start.

**Rationale**:
- Popup reads from cache (instant, <100ms render)
- Cache updates asynchronously (no blocking)
- 24h sync interval acceptable for subscription state (rarely changes)
- On-demand sync triggered when user opens settings/subscription view
- Enables offline-first experience (works without internet briefly)

**Implications**:
- subscription-service checks local cache first
- Background job (subscription-sync) periodically polls Supabase
- On state change (renewal, cancellation, downgrade), service worker notifies popup
- Cache has last_synced_at timestamp to detect stale data

**Status**: ✅ APPROVED (Plan Phase 1)

---

### D010: No New Extension Permissions Required ✅

**Context**: Stripe and Supabase access requires networking; verify manifest doesn't need new permissions.

**Decision**: No new permissions needed. All calls via standard HTTPS fetch() from existing `host_permissions`.

**Rationale**:
- Manifest already permits HTTPS calls to external APIs (set up for existing features)
- Stripe and Supabase use standard REST APIs
- No file system, tabs, identity, or dangerous permissions needed
- MV3 compliance maintained

**Implications**:
- manifest.json unchanged
- No permission warnings for users
- Fully compatible with MV3 security model

**Status**: ✅ APPROVED (Plan Phase 1)

---

## Unresolved Decisions (For Phase 0 Research)

### Q1: Stripe Pricing Model
- [ ] Single plan ($X/month) or multiple tiers?
- [ ] Annual option or monthly only?
- [ ] **Decision Pending**: Spec says "Single premium tier, monthly billing, no annual in MVP"

### Q2: Bundle Size Impact Investigation
- [ ] Measure Supabase JS client size
- [ ] Measure Stripe.js impact when loaded
- [ ] Quality gate: Total increase ≤50KB
- [ ] **Decision Pending**: Phase 0 research

### Q3: Webhook Signature Verification
- [ ] Verify Stripe webhook signing key setup
- [ ] Implement HMAC-SHA256 signature verification
- [ ] Store webhook secret securely in Supabase
- [ ] **Decision Pending**: Phase 2 (backend implementation)

---

## Completed Clarifications (From Spec QA)

### Payment Failure Handling (FR-010)
✅ **Resolved**: 3-day grace period with daily retries and auto-downgrade

### Trial Period (FR-014)
✅ **Resolved**: 14-day free trial with pre-billing reminder on day 12

---

## Phase Gates & Checkpoints

- [ ] **Phase 1 Checkpoint**: All directory structures and config files created
- [ ] **Phase 2 Checkpoint**: Supabase migrations and backend functions ready for testing
- [ ] **Phase 3 Checkpoint**: User Story 1 (upgrade flow) end-to-end teseable
- [ ] **Phase 8 Checkpoint**: All contract documentation (research.md, data-model.md, quickstart.md) complete

---

## Future Decisions (Post-MVP)

- [ ] Annual billing and enterprise tiers
- [ ] Family plans or team billing
- [ ] Usage-based pricing (activity-based overage charges)
- [ ] Promotional discount codes
- [ ] Geographic pricing variations
