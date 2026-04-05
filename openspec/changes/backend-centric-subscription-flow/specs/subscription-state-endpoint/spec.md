## ADDED Requirements

### Requirement: get-subscription-status SHALL return complete subscription state for the authenticated user

The `get-subscription-status` endpoint SHALL return a unified response containing user identity and full subscription state for the authenticated Supabase user.

#### Scenario: Free user response

```gherkin
Given a user with no active premium subscription
When the extension calls get-subscription-status with a valid Supabase JWT
Then the response includes:
  | field                | value    |
  | user_id              | <uuid>   |
  | email                | <email>  |
  | plan_type            | "free"   |
  | status               | "active" |
  | reminder_limit       | 5        |
  | can_create_reminder  | true (if pending < 5) |
```

#### Scenario: Premium user response with full subscription details

```gherkin
Given a user with an active premium subscription
When the extension calls get-subscription-status with a valid Supabase JWT
Then the response includes:
  | field                  | value              |
  | user_id                | <uuid>             |
  | email                  | <email>            |
  | plan_type              | "premium"          |
  | status                 | "active"           |
  | reminder_limit         | -1                 |
  | can_create_reminder    | true               |
  | next_billing_date      | <ISO date or null> |
  | current_period_end     | <ISO date or null> |
  | trial_end_date         | <ISO date or null> |
  | grace_period_end_date  | <ISO date or null> |
  | cancellation_date      | <ISO date or null> |
```

#### Scenario: Grace period user response

```gherkin
Given a user whose subscription is in grace_period status
When the extension calls get-subscription-status
Then the response includes plan_type = "premium", status = "grace_period"
And includes grace_period_end_date so the extension can show a warning
```

#### Scenario: Expired grace period triggers downgrade

```gherkin
Given a premium user whose grace_period_end_date is in the past
When the extension calls get-subscription-status
Then the backend updates the subscription status to "downgraded"
And returns plan_type = "free", status = "downgraded", downgrade_reason = "grace_period_expired"
```

### Requirement: create-paddle-checkout SHALL use the authenticated Supabase user

The `create-paddle-checkout` endpoint SHALL require a valid Supabase JWT and SHALL use the authenticated user's canonical Supabase user ID for checkout and Paddle linkage.

#### Scenario: Checkout for authenticated user

```gherkin
Given an authenticated user with a valid Supabase session
When the user calls create-paddle-checkout with a valid Supabase JWT
Then the backend creates a Paddle transaction with custom_data.user_id = <auth.users.id>
And returns the checkout URL
```

### Requirement: paddle-webhook-handler SHALL NOT depend on plan_type in user_profiles

The `paddle-webhook-handler` SHALL update only the `subscriptions` table when processing events. It SHALL NOT write to `user_profiles.plan_type` (which will be removed).

#### Scenario: transaction.completed updates subscriptions only

```gherkin
Given a Paddle transaction.completed webhook for user_id = <uuid>
When the webhook handler processes the event
Then the subscriptions table is upserted with status = "active" and plan_type = "premium"
And no write is made to user_profiles.plan_type
```

### Requirement: Extension SHALL cache subscription state locally

The extension SHALL cache the response from `get-subscription-status` in `chrome.storage.local` under the `subscriptionStatus` key. This cache SHALL be used for immediate UI rendering on popup open, with a background refresh to keep it current.

#### Scenario: Cached subscription used for instant popup render

```gherkin
Given a cached subscriptionStatus with planType = "premium"
When the popup opens
Then the popup immediately renders premium UI from cache
And triggers a background get-subscription-status call to refresh the cache
```

#### Scenario: Background refresh updates cache

```gherkin
Given the popup rendered from cache
When the background get-subscription-status call completes with updated data
Then the subscriptionStatus cache is updated with the new data
And the popup UI refreshes if the plan state changed
```

### Requirement: User-facing subscription endpoints SHALL reject non-Supabase credentials

User-facing subscription/account endpoints SHALL accept only Supabase JWTs and SHALL reject raw Google access tokens or unauthenticated requests.

#### Scenario: Raw Google token is rejected

```gherkin
Given a request uses a raw Google access token instead of a Supabase JWT
When the request is sent to get-subscription-status
Then the backend returns HTTP 401
And no subscription state is returned
```
