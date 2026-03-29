## Context

WAReminder uses a `payment-service.js` module in the extension and two Supabase Edge Functions (`create-xendit-invoice`, `xendit-webhook-handler`) to handle premium upgrades via Xendit. Xendit is the only payment provider and is hard-wired throughout. The goal is to switch to Paddle while keeping Xendit fully intact so swapping back is a one-line change.

Current entry points:
- `src/services/payment-service.js` — called by the service worker; exposes `initiateCheckout()`, `redirectToCustomerPortal()`, `handleCheckoutSuccess()`
- `supabase/functions/create-xendit-invoice/` — creates a Xendit invoice, returns `{ invoiceUrl }`
- `supabase/functions/xendit-webhook-handler/` — verifies `x-callback-token`, processes `invoice.paid` and `recurring_payment.*` events

## Goals / Non-Goals

**Goals:**
- Switch active payment provider to Paddle
- Keep the full Xendit implementation working and selectable without code changes
- Add a single `PAYMENT_PROVIDER` constant that controls which provider is active
- Introduce a provider interface so both implementations are interchangeable
- Keep `payment-service.js` public API identical so no other code needs to change

**Non-Goals:**
- Running Xendit and Paddle simultaneously for the same user
- A dynamic/runtime provider switch (e.g. feature flag per user) — this is a deploy-time constant
- Changing the subscription status storage schema
- Supporting multiple currencies or pricing tiers in this change

## Decisions

### 1. Provider interface with two concrete implementations

**Decision**: Define a provider interface (documented in JSDoc) with four functions: `initiateCheckout()`, `redirectToCustomerPortal(userId)`, `handleCheckoutSuccess(transactionId)`, `isConfigured()`. Extract the existing Xendit logic into `src/services/providers/xendit-provider.js` and add `src/services/providers/paddle-provider.js` implementing the same interface. `payment-service.js` becomes a router that imports the active provider based on `PAYMENT_PROVIDER`.

**Alternatives considered**:
- *Overwrite `payment-service.js` with Paddle* — loses Xendit entirely; rollback requires rewriting.
- *Archive Xendit files* — preserves code but adds friction to restore; with a router pattern the swap is a constant change.
- *Class-based inheritance* — unnecessary complexity for two providers in vanilla JS.

### 2. `PAYMENT_PROVIDER` constant drives provider selection

**Decision**: Add `PAYMENT_PROVIDER: "paddle"` to `src/lib/constants.js`. `payment-service.js` does `import { PAYMENT_PROVIDER } from "../lib/constants.js"` and forwards all calls to the matching provider module. Changing the constant to `"xendit"` and reloading the extension restores Xendit with no other code changes.

**Alternatives considered**: Runtime environment variable — not easily readable from the extension bundle without a build step.

### 3. Both Xendit Edge Functions stay deployed and unchanged

**Decision**: Do not touch `create-xendit-invoice` or `xendit-webhook-handler`. They remain deployed. The extension controls which checkout URL it calls based on `PAYMENT_PROVIDER`. The Xendit webhook endpoint stays registered in Xendit's dashboard — it simply won't receive new events until a payment is initiated through Xendit again.

**Rationale**: Zero-touch rollback. No undeployment, no file moves.

### 4. Paddle uses hosted checkout (not inline overlay)

**Decision**: `create-paddle-checkout` Edge Function returns a Paddle hosted checkout URL. The extension opens it in a new tab, matching the existing Xendit invoice flow exactly.

**Rationale**: Paddle's hosted checkout requires no extra SDK in the extension; no CSP changes needed in `manifest.json`.

### 5. Webhook handler uses Paddle signature verification

**Decision**: `paddle-webhook-handler` verifies the `Paddle-Signature` header using HMAC-SHA256 with `PADDLE_WEBHOOK_SECRET`. Xendit used a shared static token (`x-callback-token`); Paddle uses a time-stamped HMAC which is more secure.

## Risks / Trade-offs

- **Both webhook handlers deployed simultaneously** → Only the one registered in each payment platform's dashboard will receive events. No risk of double-processing.
- **Provider selection is compile-time, not runtime** → Switching providers requires a constants change and extension reload. Acceptable for a developer-controlled swap.
- **Webhook event shape differs between providers** → Each provider's handler maps events independently to the same Supabase schema. No shared mapping code needed.
- **Trial period** → Paddle supports trial periods via price configuration in the dashboard. The 14-day trial logic in `create-xendit-invoice` is not replicated in code — Paddle dashboard handles it.
- **Paddle price ID required** → `PADDLE_PRICE_ID` env var must be set before `create-paddle-checkout` can work. Sandbox ID sufficient for testing.

## Migration Plan

1. Add `PAYMENT_PROVIDER: "paddle"` to `src/lib/constants.js`
2. Create `src/services/providers/xendit-provider.js` — move existing Xendit logic from `payment-service.js`
3. Create `src/services/providers/paddle-provider.js` — implement provider interface for Paddle
4. Rewrite `src/services/payment-service.js` as a router delegating to the active provider
5. Create `supabase/functions/create-paddle-checkout/index.ts`
6. Create `supabase/functions/paddle-webhook-handler/index.ts`
7. Deploy: `supabase functions deploy create-paddle-checkout && supabase functions deploy paddle-webhook-handler`
8. Set Paddle env vars: `PADDLE_API_KEY`, `PADDLE_PRICE_ID`, `PADDLE_WEBHOOK_SECRET`
9. Register `paddle-webhook-handler` URL in Paddle dashboard
10. Smoke test in Paddle sandbox

**Rollback**: Change `PAYMENT_PROVIDER` from `"paddle"` to `"xendit"` in `constants.js` and reload the extension. No server changes needed.

## Open Questions

- Does Paddle require the extension's `externally_connectable` manifest entry for any postMessage flows, or is the hosted-checkout-in-new-tab approach sufficient? (Expected: tab approach is sufficient — no manifest change needed.)
- What Paddle price ID and billing interval will be used for production? (Needed before deploying to production — sandbox ID can be used for testing.)
