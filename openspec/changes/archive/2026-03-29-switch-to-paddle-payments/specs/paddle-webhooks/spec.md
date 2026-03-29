## ADDED Requirements

### Requirement: Verify Paddle webhook signature
The `paddle-webhook-handler` Edge Function SHALL verify every incoming request using HMAC-SHA256 signature verification against the `Paddle-Signature` header and `PADDLE_WEBHOOK_SECRET` environment variable before processing any event.

#### Scenario: Valid signature accepted
- **WHEN** a POST request arrives with a valid `Paddle-Signature` header
- **THEN** the function proceeds to parse and handle the event

#### Scenario: Missing signature rejected
- **WHEN** a POST request arrives without a `Paddle-Signature` header
- **THEN** the function returns HTTP 400 without processing the event

#### Scenario: Invalid signature rejected
- **WHEN** a POST request arrives with a `Paddle-Signature` header that does not match the computed HMAC
- **THEN** the function returns HTTP 401 without processing the event

### Requirement: Handle transaction.completed event
The `paddle-webhook-handler` SHALL process `transaction.completed` events by activating the user's subscription in the `subscriptions` Supabase table with `status = "active"` and the correct billing period dates.

#### Scenario: New subscription activated
- **WHEN** a verified `transaction.completed` event is received for a user with no existing subscription
- **THEN** the function creates a subscription record with `plan_type = "premium"`, `status = "active"`, and `next_billing_date` from the Paddle transaction data

#### Scenario: Existing subscription renewed
- **WHEN** a verified `transaction.completed` event is received for a user with an existing subscription
- **THEN** the function updates the subscription's `next_billing_date` and sets `status = "active"`

### Requirement: Handle subscription.canceled event
The `paddle-webhook-handler` SHALL process `subscription.canceled` events by setting the user's subscription `status = "cancelled_pending"` and preserving `current_period_end` so access continues until the billing period ends.

#### Scenario: Subscription cancellation recorded
- **WHEN** a verified `subscription.canceled` event is received
- **THEN** the function updates the subscription record with `status = "cancelled_pending"` and `current_period_end` from the event data

### Requirement: Handle subscription.payment.failed event
The `paddle-webhook-handler` SHALL process `subscription.payment.failed` events by setting `status = "past_due"` and logging the failure for monitoring.

#### Scenario: Payment failure recorded
- **WHEN** a verified `subscription.payment.failed` event is received
- **THEN** the function updates the subscription record with `status = "past_due"`


