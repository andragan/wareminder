# Implementation Plan: Premium Upgrade Feature

**Branch**: `002-premium-upgrade` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-premium-upgrade/spec.md`

## Summary

Backend account system (Supabase) with subscription lifecycle management, integrated payment processor (Stripe), and extension UI modifications to support premium plan enforcement (removing 5-reminder limit), displaying subscription status, and upsell prompts at plan limits. The plan covers user account registration, subscription creation via Stripe checkout, subscription state synchronization, grace period handling for failed renewals, and premium feature access control in the reminder service.

## Technical Context

**Language/Version**: JavaScript (ES2022+) with `// @ts-check` annotations; Node.js/TypeScript for backend functions (if needed)  
**Primary Dependencies**: Stripe API (payment processing & customer portal); Supabase (backend: auth, subscriptions table, user profiles table); Chrome Extensions API (Manifest V3)  
**Storage**: Supabase PostgreSQL backend for subscription state; Chrome local storage cache for offline access (synced with backend)  
**Testing**: Jest + jest-chrome for extension; Supabase testing library or manual REST API tests for backend functions  
**Target Platform**: Chrome browser (desktop); Stripe-hosted checkout and customer portal  
**Project Type**: Extended Chrome extension + Supabase backend  
**Performance Goals**: Checkout flow <5 minutes total; payment confirmation & subscription activation <10 seconds; subscription status sync to extension <2 seconds on refresh  
**Constraints**: PCI compliance (Stripe handles card data, never local storage); failed renewals handled with 3-day grace period; zero payment data in extension logs; subscription state persists across clears via backend  
**Scale/Scope**: Single premium tier, monthly billing, supporting 10k+ users, no tiered or annual pricing in MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate (Phase 0 Entry)

| # | Constitution Principle | Requirement | Status | Notes |
|---|----------------------|-------------|--------|-------|
| 1 | I. Code Quality First | Single responsibility per file; payment logic separate from subscription management, both separate from extension UI | ✅ PASS | Will separate: backend functions, services, UI components |
| 2 | I. Code Quality First | Functions ≤40 lines; JSDoc on all public functions | ✅ PASS | Will enforce during implementation |
| 3 | I. Code Quality First | `// @ts-check` or TypeScript; ESLint with zero warnings | ✅ PASS | Extends existing project setup |
| 4 | I. Code Quality First | No magic numbers; constants in dedicated file | ✅ PASS | Plan includes new constants for trial period, grace period, limits |
| 5 | I. Code Quality First | MV3 best practices; minimal permissions; no remote code | ✅ PASS | No new permissions needed; backend via API calls only |
| 6 | II. Testing Standards | Unit tests ≥80% coverage; integration tests for payment/subscription flow | ✅ PASS | Jest tests planned for subscription service; backend function tests |
| 7 | II. Testing Standards | E2E acceptance test per user story; `npm test` single command | ✅ PASS | Will test: upgrade flow, premium feature unlock, subscription management |
| 8 | II. Testing Standards | Test files mirror source structure | ✅ PASS | New tests in `tests/unit/services/subscription-service.test.js`, etc. |
| 9 | III. UX Consistency | Upgrade prompt matches WhatsApp Web & wareminder visual language | ✅ PASS | Spec requires inline messaging, premium badge styling |
| 10 | III. UX Consistency | Upgrade flow completes in <5 minutes (checkout + payment) | ✅ PASS | SC-001 explicitly requires this |
| 11 | III. UX Consistency | Inline errors, no `alert()` dialogs for payment issues | ✅ PASS | Spec requires clear error messaging (FR-004) |
| 12 | III. UX Consistency | User-facing text externalized for i18n | ✅ PASS | All messages added to `_locales/en/messages.json` |
| 13 | IV. Performance | Popup still renders in <100ms; no blocking network calls | ✅ PASS | Subscription state cached locally; async syncs in background |
| 14 | IV. Performance | Subscription check does not block reminder creation | ✅ PASS | Local cache checked first; backend sync is non-blocking |
| 15 | IV. Performance | No payment data in logs; PCI compliance maintained | ✅ PASS | Stripe handles all card data; extension never sees card details |
| 16 | IV. Performance | Bundle size increase ≤50KB (new code + deps) | ⚠️ INVESTIGATE | Need to analyze Supabase client size and Stripe.js impact |
| 17 | Dev Workflow | Feature branch naming; Conventional Commits | ✅ PASS | Branch `002-premium-upgrade` follows convention |
| 18 | Quality Gates | All gates (lint, test, perf, manifest, size, UX) apply | ⚠️ REQUIRES DESIGN | Size gate may need adjustment if new deps exceed 50KB |

**Gate Result**: ✅ CONDITIONAL PASS (with size investigation) — Proceed to Phase 0; investigate bundle size impact in research phase.

**Size Gate Investigation Required**:
- Supabase JS client size: [NEEDS RESEARCH]
- Stripe.js library size: [NEEDS RESEARCH]
- Total bundle increase acceptable if ≤50KB

### Post-Design Gate (Phase 1 Re-check)

*Deferred until Phase 1 design completion; will verify:*
- Single responsibility in new 4-5 source files (subscription-service, account-service, upgrade-ui)
- <40 line functions with JSDoc
- No PCI compliance violations (card data handling)
- Bundle size impact quantified
- Payment failure recovery logic matches business rules
- UX matches wareminder visual language
- All new text externalized for i18n

## Project Structure

### Documentation (this feature)

```text
specs/002-premium-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings (payment processor evaluation, Supabase integration, trial/grace period logic)
├── data-model.md        # Phase 1: Entity definitions (User, Subscription, PaymentTransaction, SubscriptionEvent)
├── quickstart.md        # Phase 1: Developer setup (environment variables, Stripe test keys, Supabase schema, running locally)
├── contracts/
│   ├── manifest.md      # No new permissions; no manifest changes for MVP
│   ├── services.md      # Subscription service, account service, payment webhook handler
│   └── messages.md      # New i18n strings for upgrade prompts, premium badge, subscription status, errors
└── tasks.md             # Phase 2: Task breakdown (not created by /speckit.plan)
```

### Backend (Supabase)

```text
supabase/
├── migrations/
│   ├── 001_create_user_profiles.sql      # User table with plan type (free/premium)
│   ├── 002_create_subscriptions.sql      # Subscription table with metadata
│   ├── 003_create_payment_transactions.sql # Billing history
│   └── 004_create_subscription_events.sql # Audit trail
└── functions/
    ├── stripe-webhook-handler/           # Handle payment.success, customer.subscription.updated, etc.
    ├── get-subscription-status/          # API endpoint to check user subscription status
    └── create-checkout-session/          # API endpoint to initiate Stripe checkout
```

### Extension Source Code (additions to /src)

```text
src/
├── services/
│   ├── subscription-service.js     # [NEW] CRUD for subscriptions, grace period logic, downgrade logic
│   ├── account-service.js          # [NEW] User account state, plan enforcement
│   ├── payment-service.js          # [NEW] Interaction with Stripe (initiate checkout, redirect to portal)
│   └── reminder-service.js         # [MODIFIED] Add plan limit enforcement (5 reminders for free, unlimited for premium)
├── lib/
│   ├── constants.js                # [MODIFIED] Add: TRIAL_DAYS = 14, GRACE_PERIOD_DAYS = 3, STRIPE_KEY, SUPABASE_URL
│   └── validators.js               # [NO CHANGE] Reuse for payment validation if needed
├── popup/
│   ├── popup.html                  # [MODIFIED] Add premium badge, upgrade prompt UI, account settings section
│   ├── popup.js                    # [MODIFIED] Add upgrade button handler, subscription status display, plan limit check
│   └── popup.css                   # [MODIFIED] Add styles for premium badge, upgrade prompt, limit warning
├── background/
│   ├── service-worker.js           # [MODIFIED] Add subscription state sync from backend on startup
│   └── subscription-sync.js        # [NEW] Background job to sync subscription status from Supabase periodically (every 24h or on app open)
├── _locales/
│   └── en/
│       └── messages.json           # [MODIFIED] Add: premium_badge, upgrade_prompt, free_plan_limit_reached, subscription_active, subscription_cancelled, grace_period_warning, etc.
└── manifest.json                   # [NO CHANGE] No new permissions required; API calls are standard HTTPS
```

### Extension Tests (additions to /tests)

```text
tests/
├── unit/
│   └── services/
│       ├── subscription-service.test.js  # [NEW] Subscription CRUD, grace period logic, downgrade triggering
│       ├── account-service.test.js       # [NEW] Plan enforcement, free vs premium limits
│       └── payment-service.test.js       # [NEW] Stripe interaction, checkout session creation
├── integration/
│   └── subscription-sync.test.js         # [NEW] Background sync ↔ storage interaction, local cache updates
└── e2e/ (manual or Playwright)
    ├── upgrade-flow.test.js              # [NEW] User story 1: Free → Premium via checkout
    ├── premium-features.test.js          # [NEW] User story 2: Premium access, unlimited reminders
    └── subscription-management.test.js   # [NEW] User story 3: Cancel, manage payment method, view billing
```

**Structure Decision**: 
- Extend existing Chrome extension architecture (no new frameworks).
- Add Supabase backend for persistent subscription state (survives storage clears, device changes).
- Stripe handles all payment processing; extension never touches card data.
- New services: `subscription-service` (state machine + CRUD), `account-service` (plan enforcement), `payment-service` (Stripe API calls).
- Modify existing `reminder-service` to check plan limits before creation.
- Background sync job polls Supabase for subscription state changes (renewal, cancellation, grace period expiry).
- Popup UI extended with premium badge, upgrade button, subscription details link.

## Complexity Tracking

> **Justified Complexity**: Introduction of Supabase backend and Stripe integration adds architectural complexity beyond the local-storage-only MVP (feature 001).

| Complexity | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Supabase backend (PostgreSQL) | Subscription state must persist across browser clears, device changes, and multiple browsers. Local storage alone cannot survive storage permission changes or reinstalls. Grace period logic requires server-side state machine (retry attempts, downgrade date). | Local-only approach loses user data on clear/reinstall; cannot track retry state reliably. Would break trust with paying users. Must use backend for audit trail & payment reconciliation. |
| Stripe integration | PCI compliance requires that the extension NEVER handle raw card data. Stripe-hosted checkout and customer portal are industry standard for this use case. | Building custom payment form violates PCI compliance; Stripe handles encryption, fraud detection, regulatory compliance. Custom payment processor would require SOC 2 audit and insurance. |
| 3 new backend functions + migrations | Webhook handler must process Stripe events (payment success, renewal, cancellation). API endpoints needed for checkout initiation and status checks. Database schema for subscriptions, transactions, and audit trail. | Stripe webhooks → email notifications would be too slow for UX; manual reconciliation would not scale. No backend SQL means no reliable grace period state machine or retry tracking. |
| Background sync job in service worker | Subscription status changes (renewal, cancellation, grace period expiry, downgrade after grace) must be visible to the extension without user action. Local cache enables offline access; async sync prevents blocking popup render. | Manual sync on popup open would be slow and unreliable. Server-push (WebSocket) unnecessary overhead for 24h sync cadence. REST polling with cache is simplest, most reliable architecture. |
| 4 new extension files (3 services + sync) | Separation of concerns: subscription-service (state), account-service (limits), payment-service (Stripe calls), subscription-sync (background job). | Monolithic service would exceed 40-line function limit; mixed concerns reduce testability and maintainability. |
| 3 new storage tables (Supabase) | Subscriptions table (core state), PaymentTransactions (billing history), SubscriptionEvents (audit trail). Separate from reminders table. | Storing subscription data in reminders table couples unrelated concepts; audit trail in subscriptions table would create ambiguity on state changes. Separate tables enable independent scaling and compliance audits. |

**Conclusion**: All introduced complexity is necessary for a production-grade subscription system handling real money, compliance requirements, and user data integrity. No unnecessary frameworks or processes are added.
