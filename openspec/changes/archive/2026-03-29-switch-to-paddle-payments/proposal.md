## Why

We need to switch from Xendit to Paddle for payment processing. Rather than a hard swap, we want both providers to remain fully functional behind a common interface so that switching back to Xendit is trivial — just change one constant.

## What Changes

- Introduce a provider interface: both Xendit and Paddle implement identical functions (`initiateCheckout`, `redirectToCustomerPortal`, `handleCheckoutSuccess`, `isConfigured`)
- Extract the existing Xendit logic from `src/services/payment-service.js` into `src/services/providers/xendit-provider.js`
- Add `src/services/providers/paddle-provider.js` implementing the same interface using Paddle Billing
- Convert `src/services/payment-service.js` into a router that reads `PAYMENT_PROVIDER` from constants and delegates all calls to the active provider
- Add a new Supabase Edge Function `create-paddle-checkout` to create a Paddle Billing checkout session
- Add a new Supabase Edge Function `paddle-webhook-handler` to process Paddle webhook events (`transaction.completed`, `subscription.canceled`, `subscription.payment.failed`)
- Add `PAYMENT_PROVIDER: "paddle"` to `src/lib/constants.js` — changing it to `"xendit"` restores the old provider with no other code changes
- Xendit Edge Functions (`create-xendit-invoice`, `xendit-webhook-handler`) are kept intact and unchanged
- No changes to subscription status storage schema — both providers map to the same local shape

## Capabilities

### New Capabilities

- `paddle-checkout`: Initiate a Paddle Billing checkout session from the extension popup; open the hosted checkout URL in a new tab
- `paddle-webhooks`: Handle Paddle webhook events server-side (transaction completed, subscription lifecycle) and update subscription records in Supabase

### Modified Capabilities

<!-- No existing spec-level requirements are changing — the external interface (initiateCheckout, redirectToCustomerPortal) stays the same; only the provider under the hood changes -->

## Impact

- `src/services/payment-service.js` — becomes a thin router; public API (`initiateCheckout`, `redirectToCustomerPortal`, `handleCheckoutSuccess`) unchanged
- `src/services/providers/xendit-provider.js` — new file; contains the existing Xendit logic moved from `payment-service.js`
- `src/services/providers/paddle-provider.js` — new file; Paddle implementation of the provider interface
- `supabase/functions/create-xendit-invoice/` and `supabase/functions/xendit-webhook-handler/` — untouched
- New env vars required: `PADDLE_API_KEY`, `PADDLE_PRICE_ID`, `PADDLE_WEBHOOK_SECRET`
- `src/lib/constants.js` gains `PAYMENT_PROVIDER = "paddle"` as a deploy-time provider switch
