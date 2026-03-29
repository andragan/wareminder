## 1. Extension Constants

- [x] 1.1 Add `PAYMENT_PROVIDER: "paddle"` to `src/lib/constants.js`

## 2. Extract Xendit Provider

- [x] 2.1 Create `src/services/providers/` directory
- [x] 2.2 Create `src/services/providers/xendit-provider.js` — move the existing Xendit logic from `payment-service.js` into it, exporting `initiateCheckout`, `redirectToCustomerPortal`, `handleCheckoutSuccess`, and `isConfigured`
- [x] 2.3 Verify `xendit-provider.js` exports match the provider interface exactly (same function signatures and return types as the original `payment-service.js`)

## 3. Implement Paddle Provider

- [x] 3.1 Create `src/services/providers/paddle-provider.js` implementing the same interface: `initiateCheckout`, `redirectToCustomerPortal`, `handleCheckoutSuccess`, `isConfigured`
- [x] 3.2 `initiateCheckout()` — get auth token, POST to `create-paddle-checkout`, open returned `checkoutUrl` in a new tab
- [x] 3.3 `redirectToCustomerPortal(userId)` — open the Paddle customer portal URL in a new tab (Paddle provides a direct URL; no server call needed)
- [x] 3.4 `handleCheckoutSuccess(transactionId)` — update local storage subscription cache with `plan_type: "premium"` and `transaction_id`
- [x] 3.5 `isConfigured()` — return `!!SUPABASE_CONFIG.URL`

## 4. Convert Payment Service to Router

- [x] 4.1 Rewrite `src/services/payment-service.js` to import `PAYMENT_PROVIDER` from constants and the two provider modules
- [x] 4.2 Implement a `getProvider()` helper that returns the correct provider module based on `PAYMENT_PROVIDER` (throws if value is unrecognized)
- [x] 4.3 Re-export `initiateCheckout`, `redirectToCustomerPortal`, `handleCheckoutSuccess` — each just calls `getProvider().<fn>(...args)`
- [x] 4.4 Replace `isXenditConfigured()` export with `isPaymentConfigured()` that calls `getProvider().isConfigured()`
- [x] 4.5 Verify no changes are needed in `src/background/service-worker.js` — the import of `PaymentService` and its call sites must remain identical

## 5. Create Paddle Checkout Edge Function

- [x] 5.1 Create `supabase/functions/create-paddle-checkout/index.ts`
- [x] 5.2 Implement auth token extraction and Google OAuth email resolution (mirror pattern from `create-xendit-invoice`)
- [x] 5.3 Implement user profile lookup / auto-create in `user_profiles` table
- [x] 5.4 Call Paddle Billing API to create a checkout session using `PADDLE_API_KEY` and `PADDLE_PRICE_ID`
- [x] 5.5 Return `{ checkoutUrl: string }` on success; return appropriate HTTP error codes on failure
- [x] 5.6 Add CORS headers to support preflight OPTIONS requests

## 6. Create Paddle Webhook Handler Edge Function

- [x] 6.1 Create `supabase/functions/paddle-webhook-handler/index.ts`
- [x] 6.2 Implement `Paddle-Signature` HMAC-SHA256 verification using `PADDLE_WEBHOOK_SECRET`
- [x] 6.3 Implement `transaction.completed` handler: upsert subscription with `status = "active"` and billing dates
- [x] 6.4 Implement `subscription.canceled` handler: update subscription with `status = "cancelled_pending"` and `current_period_end`
- [x] 6.5 Implement `subscription.payment.failed` handler: update subscription with `status = "past_due"`
- [x] 6.6 Return HTTP 200 for handled events, 400/401 for signature failures, 200 with log for unknown event types

## 7. Deploy and Configure

- [x] 7.1 Deploy `create-paddle-checkout`: `supabase functions deploy create-paddle-checkout --project-ref <ref>`
- [x] 7.2 Deploy `paddle-webhook-handler`: `supabase functions deploy paddle-webhook-handler --project-ref <ref>`
- [x] 7.3 Set `PADDLE_API_KEY` secret in Supabase dashboard
- [x] 7.4 Set `PADDLE_PRICE_ID` secret in Supabase dashboard
- [x] 7.5 Set `PADDLE_WEBHOOK_SECRET` secret in Supabase dashboard
- [x] 7.6 Register `paddle-webhook-handler` URL in Paddle dashboard; enable `transaction.completed`, `subscription.canceled`, `subscription.payment.failed` events

## 8. Smoke Test

- [x] 8.1 Load the extension with `PAYMENT_PROVIDER = "paddle"` — click upgrade, verify Paddle hosted checkout opens
- [x] 8.2 Complete a Paddle sandbox payment — verify `paddle-webhook-handler` activates the subscription in Supabase
- [x] 8.3 Trigger a Paddle sandbox cancellation — verify subscription updates to `cancelled_pending`
- [-] 8.4 Change `PAYMENT_PROVIDER` to `"xendit"`, reload extension — verify Xendit checkout still opens (rollback check) *(skipped)*
- [x] 8.5 Verify Playwright upgrade-flow tests pass with Paddle mock responses
