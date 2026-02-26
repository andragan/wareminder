# Tasks: Premium Upgrade Feature

**Input**: Specification from [spec.md](spec.md), design from [plan.md](plan.md)  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md (pending Phase 0), data-model.md (pending Phase 1), contracts/ (pending Phase 1)

**Tests**: Unit, integration, and e2e tests included (required per constitution II)

**Organization**: Tasks grouped by user story (US1-US3) to enable independent implementation and testing. Each user story can be implemented and tested independently from others.

---

## Phase 1: Setup (Project Initialization & Backend Infrastructure)

**Purpose**: Initialize Supabase project, Xendit integration, and extension file structure

**Execution**: Sequential (each task may depend on previous)

- [ ] T001 Initialize Supabase project and configure authentication (user sign-up/sign-in flow)
- [x] T002 Create Supabase migrations directory structure in `supabase/migrations/` with version control
- [ ] T003 [P] Create backend functions directory structure in `supabase/functions/`
- [ ] T003 [P] Set up Xendit test account and obtain API keys (Secret Key + Webhook Token)
- [x] T004 [P] Create environment configuration file `.env.local` with template for Xendit and Supabase credentials
- [x] T005 Create extension files structure: `src/services/`, `src/background/`, `tests/unit/services/`, `tests/integration/`, `tests/e2e/`
- [x] T006 Initialize constants file `src/lib/constants.js` with TRIAL_DAYS=14, GRACE_PERIOD_DAYS=3, FREE_PLAN_LIMIT=5, payment processor URLs
- [x] T007 Add new i18n message keys to `src/_locales/en/messages.json`: premium_badge, upgrade_prompt, subscription_active, etc.
- [x] T008 Create `.specify/memory/002-decisions.md` to track architectural decisions and clarifications

**Checkpoint**: Project structure initialized, environment configured, constants defined, no business logic yet

---

## Phase 2: Foundational (Backend & Core Services - BLOCKING)

**Purpose**: Implement subscription state machine, Xendit integration, and account system. All user stories depend on this.

**⚠️ CRITICAL**: No user story implementation begins until Phase 2 is complete

### Supabase Schema & Backend Setup

- [x] T009 Create migration `supabase/migrations/001_create_user_profiles.sql` with columns: id (UUID), email, plan_type (free|premium), created_at, updated_at, last_sync_at
- [x] T010 [P] Create migration `supabase/migrations/002_create_subscriptions.sql` with columns: id (UUID), user_id (FK), xendit_customer_id, xendit_invoice_id, plan_type, status (active|cancelled|grace_period), trial_end_date, current_period_start, current_period_end, next_billing_date, grace_period_start_date, grace_period_end_date, created_at, updated_at
- [x] T011 [P] Create migration `supabase/migrations/003_create_payment_transactions.sql` with columns: id (UUID), subscription_id (FK), amount_cents, currency, xendit_invoice_id, xendit_charge_id, status (pending|success|failed|refunded), failure_reason, created_at, updated_at
- [x] T012 [P] Create migration `supabase/migrations/004_create_subscription_events.sql` with columns: id (UUID), subscription_id (FK), event_type (payment_success|payment_failed|trial_ended|subscription_renewed|subscription_cancelled|downgrade_initiated), event_data (JSON), created_at
- [x] T013 Create Supabase RLS (Row Level Security) policies to ensure users can only access their own subscription data

### Backend Functions & Xendit Integration

- [x] T014 Create backend function `supabase/functions/xendit-webhook-handler/index.ts` to receive and process Xendit events: invoice.paid, invoice.expired, recurring_payment.succeeded, recurring_payment.failed
- [x] T015 Implement webhook handler logic: update subscription status, create transaction records, log events, handle grace period initiation on payment failure
- [x] T016 [P] Create backend function `supabase/functions/create-xendit-invoice/index.ts` to initiate Xendit invoice: accept user_id + trial days, create customer reference, return invoice URL
- [x] T017 [P] Create backend function `supabase/functions/get-subscription-status/index.ts` to return current user subscription state: plan type, trial end date, next billing date, status
- [x] T018 [P] Implement subscription state machine: state transitions (free→trial→active, active→grace_period, grace_period→free, active→cancelled), validate transitions, log state changes
- [ ] T019 Create webhook secret configuration in Supabase and Xendit (configure Xendit webhook endpoint to point to `xendit-webhook-handler`)

### Extension Service Layer

- [x] T020 Create `src/services/subscription-service.js` with CRUD operations: getSubscription(userId), createSubscription(userId), updateSubscriptionStatus(userId, newStatus), handleGracePeriod(userId), downgradeToFree(userId)
- [x] T021 [P] Create `src/services/account-service.js` with methods: getUserPlan(userId), isPremium(userId), canCreateReminder(userId, currentCount), enforceReminderLimit(userId, currentCount), syncSubscriptionFromBackend(userId)
- [x] T022 [P] Create `src/services/payment-service.js` with methods: initiateCheckout(userId), redirectToCustomerPortal(userId), handleCheckoutSuccess(sessionId)
- [x] T023 Create `src/background/subscription-sync.js` background job (non-blocking service worker task): poll Supabase for subscription status changes every 24 hours or on extension startup, update local cache, detect state changes (renewal, downgrade, cancellation), notify user of changes via chrome.notifications
- [x] T024 Modify `src/services/reminder-service.js` to integrate plan limit checking: add `checkPlanLimit(userId)` call before allowing reminder creation, return clear error message if limit exceeded

### Extension Cache & Storage Integration

- [x] T025 [P] Create local cache schema in `src/services/storage-service.js`: add subscriptionStatus object with fields: plan_type, trial_end_date, next_billing_date, status, last_synced_at
- [x] T026 [P] Implement async subscription sync in background: fetch from backend, update local cache, emit event on status change
- [x] T027 Ensure all subscription data is synced from backend on extension startup (service worker init)

### Unit Tests for Foundation Phase

- [x] T028 [P] Create unit tests `tests/unit/services/subscription-service.test.js`: test CRUD operations, state machine transitions, grace period logic, downgrade triggering
- [x] T029 [P] Create unit tests `tests/unit/services/account-service.test.js`: test getPlan(), isPremium(), plan limit enforcement (free=5, premium=unlimited)
- [x] T030 [P] Create unit tests `tests/unit/services/payment-service.test.js`: test invoice initiation (mocked Xendit calls), error handling for failed invoices
- [x] T031 [P] Create unit tests `tests/unit/services/storage-service.test.js` (extend existing): test cache updates from backend sync, local storage persistence
- [x] T032 Run unit tests and verify ≥80% coverage for all new services

**Checkpoint**: Foundation complete - subscription system operational, backend integrated, local cache synced, user story implementation can begin in parallel

---

## Phase 3: User Story 1 - Discover and Complete Upgrade (Priority: P1) 🎯 MVP

**Goal**: Free-tier user sees upgrade prompt at 5-reminder limit, completes 14-day trial checkout flow, payment processes, premium plan activates within 10 seconds

**Independent Test**: Reach 5-reminder limit → click upgrade → complete test payment via Xendit Test Mode → verify premium status appears in popup and no limit message shown → create 6+ reminders successfully

### User Story 1: Implementation Tasks

- [x] T033 [P] [US1] Modify `src/popup/popup.js` to add upgrade prompt UI handler: detect when free user reaches 5-reminder limit, display "Upgrade to Premium" button with "Remove limit and get unlimited reminders" messaging
- [x] T034 [P] [US1] Modify `src/popup/popup.html` to add upgrade prompt section: include button, pricing display ($[TBD]/month), trial offer (14 days free), note that first charge on day 15
- [x] T035 [P] [US1] Modify `src/popup/popup.css` to style upgrade prompt section matching wareminder visual language: colors, typography, spacing consistent with existing reminder list UI
- [x] T036 [US1] Implement upgrade button click handler in `src/popup/popup.js`: call payment-service.initiateCheckout(userId), open Xendit invoice in new tab/window, listen for message from payment processor
- [x] T037 [US1] Create `src/background/payment-listener.js` to handle invoice payment: listen for message from Xendit invoice completion page, verify invoice ID valid, call backend get-subscription-status endpoint, update local subscription cache, notify popup UI that upgrade succeeded
- [x] T038 [P] [US1] Add error handling in `src/popup/popup.js` for payment failures: user hits "back" button on checkout → show retry prompt "Try again" with informative message; display clear error messages for card declined, invalid input, etc.
- [ ] T039 [US1] Implement trial period countdown display in popup (optional enhancement): show "14 days free" → "Days remaining" → "Billing on [date]" as trial progresses
- [x] T040 Update `src/_locales/en/messages.json` with user story 1 specific messages: upgrade_prompt_title, upgrade_prompt_description, trial_offer_text, upgrade_button_label, billing_info

### User Story 1: Tests

- [x] T041 [P] [US1] Create e2e test `tests/e2e/upgrade-flow.test.js`: create 5 reminders as free user, verify limit message appears, click upgrade, complete Xendit test payment, verify premium status shows, create 6th reminder, verify success
- [x] T042 [P] [US1] Create integration test `tests/integration/payment-flow.test.js`: mock Stripe checkout session creation, verify backend endpoint returns correct session URL, test message passing between popup and background service worker
- [x] T043 [P] [US1] Create unit test `tests/unit/popup.test.js`: test upgrade button visibility when limit reached, test error message display on failed payment, test trial countdown display (if implemented)

**Checkpoint**: User can discover upgrade at plan limit, initiate checkout flow, complete payment, receive premium plan activation. User Story 1 is independently testable and functional.

---

## Phase 4: User Story 2 - Access Premium Features (Priority: P2)

**Goal**: Premium user sees no reminder limit and can create unlimited reminders; premium badge displayed in popup; subscription details (plan name, renewal date) visible in settings

**Independent Test**: Upgrade account to premium → open popup → verify "Premium" badge visible → create 6+ reminders → verify all created successfully (no limit enforced) → click account settings → verify plan type "Premium" and next billing date shown

### User Story 2: Implementation Tasks

- [x] T044 [P] [US2] Add premium badge UI to `src/popup/popup.html`: badge element showing "Premium" label, positioned in header next to reminder count
- [x] T045 [P] [US2] Style premium badge in `src/popup/popup.css`: distinctive styling (color, font, icon) that clearly distinguishes premium users from free users
- [x] T046 [US2] Modify `src/popup/popup.js` to display premium badge: call account-service.isPremium() on popup load, conditionally render badge only if premium = true
- [x] T047 [P] [US2] Add account settings section to `src/popup/popup.html`: new section with subscription status details (plan type, next renewal date), link to "Manage Subscription" (opens Stripe customer portal)
- [x] T048 [US2] Implement account settings logic in `src/popup/popup.js`: fetch subscription details from local cache, format and display renewal date, handle "Manage Subscription" click → call payment-service.redirectToCustomerPortal(userId)
- [x] T049 [P] [US2] Modify `src/services/reminder-service.js` to remove limit enforcement for premium users: check account-service.isPremium(userId), skip limit check if true, allow unlimited reminder creation
- [x] T050 Update `src/_locales/en/messages.json` with user story 2 messages: premium_badge_label, account_settings_title, subscription_status_label, next_renewal_date_label, manage_subscription_button

### User Story 2: Tests

- [x] T051 [P] [US2] Create e2e test `tests/e2e/premium-features.test.js`: create premium account (or mock premium state), open popup, verify premium badge visible, create 50+ reminders, verify all succeed without limit errors
- [x] T052 [P] [US2] Create integration test `tests/integration/premium-limit-enforcement.test.js`: test reminder-service with premium user, verify no limit check applied, test with free user to verify limit still enforced
- [x] T053 [P] [US2] Create unit test `tests/unit/popup-premium-badge.test.js`: test badge visibility toggling (free vs premium), test settings section display, test manage subscription link generation

**Checkpoint**: Premium users see unlimited reminders and premium status clearly displayed. User Story 2 independently functional.

---

## Phase 5: User Story 3 - Manage Subscription (Priority: P3)

**Goal**: Premium user can access subscription portal, view billing history, update payment method, cancel subscription. On cancellation, account downgrades to free plan after current period ends with clear messaging.

**Independent Test**: Log into Stripe customer portal via extension → view subscription details (plan, next renewal) → update card → verify change saved → initiate cancellation → verify "Plan downgrading after [date]" message in extension → account reverts to free plan on end date

### User Story 3: Implementation Tasks

- [x] T054 [P] [US3] Create `src/services/subscription-portal-service.js` to manage portal interactions: generate portal session link (via backend), handle cancelled subscription status, parse Stripe webhook for subscription.deleted event
- [x] T055 [US3] Implement "Manage Subscription" link in `src/popup/popup.html` account settings section: button/link that redirects to Stripe customer portal URL
- [x] T056 [US3] Modify `src/background/subscription-sync.js` to detect cancellation events: when webhook event subscription.deleted received, trigger sync from Supabase, update local subscription status to "cancelled", set downgrade date (current_period_end), show notification "Your subscription will end on [date], then revert to free plan"
- [x] T057 [P] [US3] Create cancellation warning UI in `src/popup/popup.html`: show clear message when subscription is in cancellation state: "Your subscription ends on [date]. You'll return to the free plan (5 reminders limit)." with option to re-activate
- [x] T058 [US3] Implement re-activation logic: if user re-activates cancelled subscription before period end, call backend to restore, update local state, remove cancellation warning
- [x] T059 [P] [US3] Modify account settings display to show different state based on subscription status: active → show renewal date + "Manage Subscription" button; cancelled_pending → show "Plan ending on [date]" + "Reactivate" button; free → hide subscription details section
- [x] T060 Create refund dialog/flow (if needed based on refund policy): when user cancels, show message: "Eligible for refund within 30 days"
- [x] T061 Update `src/_locales/en/messages.json` with user story 3 messages: manage_subscription_button, subscription_ending_message, plan_downgrade_notice, reactivate_button, billing_history_link

### User Story 3: Tests

- [x] T062 [P] [US3] Create e2e test `tests/e2e/subscription-management.test.js`: initiate cancellation from Stripe portal, verify extension shows cancellation warning, attempt to create reminder as free user after downgrade date passes, verify limit enforced
- [x] T063 [P] [US3] Create integration test `tests/integration/cancellation-flow.test.js`: mock Stripe webhook for subscription.deleted, verify subscription-sync updates local state, verify UI updates to show downgrade warning
- [x] T064 [P] [US3] Create unit test `tests/unit/subscription-portal.test.js`: test portal session link generation, test cancellation state transitions, test re-activation logic

**Checkpoint**: Users can fully manage subscriptions via portal, cancellations handled gracefully, downgrades to free tier on end date with user notification.

---

## Phase 6: Grace Period & Payment Failure Handling (Cross-Story)

**Purpose**: Implement 3-day grace period logic for failed renewals (applies to premium users with payment failures)

- [ ] T065 Implement grace period state in Supabase subscription table: add grace_period_start_date, grace_period_end_date columns, set on payment failure event
- [ ] T066 Modify webhook handler in `supabase/functions/stripe-webhook-handler/index.ts` to detect payment failures: on invoice.payment_failed event, transition subscription from active→grace_period, set grace_period_start_date = today, grace_period_end_date = today + 3 days, retry charge daily for 2 days
- [ ] T067 [P] Create grace period notification UI in `src/popup/popup.html`: show warning banner when user is in grace period: "Payment failed. Please update your payment method. (Retrying: Day [X] of 3)"
- [ ] T068 Modify `src/background/subscription-sync.js` to detect grace period expiry: check if grace_period_end_date < today, if so trigger downgrade to free plan, update local state, show downgrade notification
- [ ] T069 Add "Update Payment Method" quick link to grace period warning: clicking redirects to Stripe customer portal
- [ ] T070 Create grace period test helper in `tests/unit/grace-period.test.js`: test state transitions (active→grace→downgrade), test daily retry logic, test notification display

- [ ] T071 Update `src/_locales/en/messages.json` with grace period messages: payment_failed_warning, grace_period_day_counter, update_payment_method_link, subscription_downgraded_notice

**Checkpoint**: Failed payments handled gracefully with grace period, user retains premium access for 3 days to fix issue, automatic downgrade after grace period.

---

## Phase 7: Integration & Cross-Story Tests

**Purpose**: Verify all user stories work together and don't conflict

- [ ] T072 [P] Create integration test `tests/integration/multi-story-flow.test.js`: start as free user (US1) → upgrade to premium (US1) → verify unlimited reminders (US2) → cancel subscription (US3) → verify downgrade to free after period ends (US3) → re-verify limit enforced
- [ ] T073 Create integration test `tests/integration/grace-period-integration.test.js`: create premium user (US2) → simulate payment failure → verify grace period warning (Phase 6) → simulate grace period expiry → verify downgrade to free (US3)
- [ ] T074 [P] Create end-to-end test `tests/e2e/full-lifecycle.test.js`: complete user journey from account creation through upgrade, premium usage, cancellation, downgrade, and reactivation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finalize implementation, documentation, optimization, and compliance

### Documentation & Quickstart

- [ ] T075 Create `specs/002-premium-upgrade/research.md`: summarize findings from Phase 0 research (bundle size analysis, Stripe integration options, Supabase schema decisions)
- [ ] T076 Create `specs/002-premium-upgrade/data-model.md`: define entities (User, Subscription, PaymentTransaction, SubscriptionEvent) with full attribute lists and relationships
- [ ] T077 Create `specs/002-premium-upgrade/quickstart.md`: developer onboarding guide: Stripe test keys setup, Supabase local environment, environment variables, running tests, making a test payment, verifying grace period logic
- [ ] T078 Create `specs/002-premium-upgrade/contracts/manifest.md`: confirm no new permissions needed (all calls HTTP via APIs)
- [ ] T079 Create `specs/002-premium-upgrade/contracts/services.md`: document all services (subscription-service, account-service, payment-service) with method signatures, parameters, return values, error cases
- [ ] T080 Create `specs/002-premium-upgrade/contracts/messages.md`: list all i18n message keys and values for premium upgrade feature

### Code Quality & Testing

- [ ] T081 [P] Run full test suite: `npm test` for all new tests (unit + integration + e2e), verify ≥80% statement coverage for all new services
- [ ] T082 [P] Run ESLint on all new files: verify zero warnings, all functions ≤40 lines JSDoc comments required, no magic numbers outside constants.js
- [ ] T083 [P] Security review of payment flow: verify card data never touches extension, Stripe handles all encryption, webhook signatures verified, environment variables contain no secrets in code
- [ ] T084 [P] PCI compliance verification: confirm no card data in logs, no card data in local storage, all payment details handled by Stripe, no custom payment parsing
- [ ] T085 Verify bundle size impact: measure extension bundle size with new code, confirm increase ≤50KB, analyze Stripe.js and Supabase client sizes

### Performance Optimization

- [ ] T086 [P] Verify popup still renders in <100ms: measure with and without subscription data, ensure no blocking network calls on popup open
- [ ] T087 [P] Verify subscription sync is non-blocking: background job runs async, no delay to reminder creation or popup rendering
- [ ] T088 Optimize subscription-sync polling: implement smart caching to reduce Supabase queries, avoid unnecessary syncs if state hasn't changed
- [ ] T089 [P] Test with 10,000+ reminders from premium user: verify popup still responsive, pagination/virtual scrolling working

### Localization & UX

- [ ] T090 [P] Verify all user-facing text in `src/_locales/en/messages.json`: every message key used in code, no hardcoded strings in UI
- [ ] T091 Style consistency audit: verify upgrade prompt, premium badge, grace period warning, account settings all consistent with wareminder visual language (colors, typography, spacing, icons)
- [ ] T092 Accessibility review: ensure grade period warning and upgrade prompts accessible to screen readers, form inputs properly labeled

### Manual Smoke Tests

- [ ] T093 Manual test on latest Chrome stable: free user can reach limit, upgrade flow works end-to-end, payment processes in test mode, premium features work, can cancel and downgrade
- [ ] T094 Manual test payment failure scenario: simulate failed payment via Stripe test mode, verify grace period warning appears, verify notifications sent, verify downgrade after 3 days
- [ ] T095 Manual test on Windows, macOS, Linux: extension installs and functions correctly on all platforms

### Final Gate Verification

- [ ] T096 [P] Lint gate: zero ESLint errors/warnings (`npm run lint`)
- [ ] T097 [P] Test gate: all tests pass, ≥80% coverage achieved
- [ ] T098 [P] Performance gate: popup <100ms, content script <50ms, bundle ≤500KB total
- [ ] T099 [P] Size gate: bundle increase ≤50KB for new code/deps
- [ ] T100 Manifest gate: only required permissions declared, no `<all_urls>`, host permission only `*://web.whatsapp.com/*`
- [ ] T101 UX gate: manual verification that UI matches wareminder style, no alert() dialogs, all errors inline
- [ ] T102 PCI gate: zero card data in extension code/logs, Stripe handles all processing

**Checkpoint**: Feature complete, tested, documented, compliant, production-ready

---

## Task Summary by Phase

| Phase | Name | Task Count | Purpose | Dependency |
|-------|------|-----------|---------|------------|
| Phase 1 | Setup | 8 | Initialize infrastructure | Start immediately |
| Phase 2 | Foundation | 24 | Backend & core services (BLOCKS all stories) | After Phase 1 |
| Phase 3 | US1: Upgrade | 11 | Checkout, payment, plan activation | After Phase 2 |
| Phase 4 | US2: Premium | 10 | Unlimited reminders, premium badge | After Phase 2 |
| Phase 5 | US3: Manage | 8 | Subscription portal, cancellation | After Phase 2 |
| Phase 6 | Grace Period | 7 | Payment failure recovery | After Phase 2 |
| Phase 7 | Integration | 3 | Cross-story testing | After US1-3 |
| Phase 8 | Polish | 28 | Docs, optimization, gates | After Phase 7 |
| **TOTAL** | | **102 tasks** | | |

---

## Dependencies & Parallel Execution

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKING)
    ↓
    ├→ Phase 3: User Story 1 (P1: Upgrade) ─→ 
    ├→ Phase 4: User Story 2 (P2: Premium) ─→ 
    └→ Phase 5: User Story 3 (P3: Manage) ─→ Phase 7: Integration Tests
                                         ↗
Phase 6: Grace Period (cross-cutting) ──→ (can start after Phase 2)
```

### Within-Phase Parallelization

**Phase 2 Foundation** (can run in parallel after Phase 1):
- T009-T013: Database migrations (all [P], can run in parallel)
- T014-T019: Backend functions (T014-T015 sequential, T016-T019 [P] parallel)
- T020-T027: Extension services (T020 first, then T021-T026 [P] parallel, T027 blocks on T026)
- T028-T032: Unit tests (all [P], run in parallel)

**Phase 3: US1** (after Phase 2):
- T033-T035: UI structure ([P], parallel)
- T036-T040: Button handlers and messages (T036 depends on T035, rest [P])
- T041-T043: Tests (all [P], parallel)

**Phase 4: US2** (after Phase 2, parallel with Phase 3):
- T044-T045: Badge UI ([P], parallel)
- T046-T050: Premium logic (T046 depends on T045, rest [P])
- T051-T053: Tests (all [P], parallel)

**Phase 5: US3** (after Phase 2, parallel with Phase 3-4):
- T054-T055: Portal services ([P], parallel)
- T056-T061: Cancellation handlers (T056 first, rest [P])
- T062-T064: Tests (all [P], parallel)

**Phase 8: Polish** (after Phase 7):
- Most tasks marked [P] can run in parallel
- Final gates (T096-T102) must finish all implementation before starting

---

## MVP Scope Recommendation

**Minimum Viable Product** (Phase 3, US1 + foundational Phase 2):
- Supabase user accounts + stripe checkout flow
- 14-day free trial with first payment on day 15
- Premium plan removes 5-reminder limit
- Basic "Premium" badge display
- **Delivers**: User can upgrade and unlock unlimited reminders

**Extensions for Phase 4-5** (if time/resources available):
- Subscription management portal integration
- Grace period payment failure handling
- Full account settings UI

**MVP Delivers Business Value**: Converts free users to paying customers, removes primary friction point (5-reminder limit), establishes subscription revenue stream.

**MVP Task Count**: 32 tasks (8 Setup + 24 Foundational) = 2-3 weeks with 1 developer, then 2-3 more weeks for US1 implementation (11 tasks)

---

## Testing Strategy Summary

| Test Type | Who | When | Coverage |
|-----------|-----|------|----------|
| Unit Tests | Developer | Per task (TDD) | Services: subscription, account, payment, storage |
| Integration Tests | Developer | Phase completion | Payment flow, sync flow, limit enforcement, grace period state machine |
| E2E Tests | QA/Automation | Feature complete | Full upgrade flow, premium features, subscription mgmt, payment failure recovery |
| Manual Smoke Tests | QA/Product | Pre-launch | Cross-platform (Win/Mac/Linux), real Stripe test mode, accessibility |

**Entry Criteria**: Unit tests written first (T-TDD approach), must FAIL before implementation  
**Success Criteria**: ≥80% coverage, all user stories independently testable, manual smoke tests pass

---

## Notes for Implementation

1. **Backend Development**: Supabase SQL migrations (Phase 2) are critical path - start here for DB schema stability
2. **Payment Testing**: Use Stripe test mode card numbers (4242 4242 4242 4242 for success, 4000 0000 0000 0002 for decline) during development
3. **Grace Period**: Most complex logic in Phase 6 - implement state machine carefully, test retry logic exhaustively
4. **UX Consistency**: Premium badge and upgrade prompts must match wareminder styling - review with designer early (Phase 3)
5. **Communication**: Subscribe to Stripe webhooks early (Phase 2) - don't wait for US1 implementation

