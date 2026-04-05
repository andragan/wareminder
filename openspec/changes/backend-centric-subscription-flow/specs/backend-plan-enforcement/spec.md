## ADDED Requirements

### Requirement: Backend SHALL enforce reminder creation limits

The backend SHALL provide a `check-reminder-limit` endpoint that validates whether the authenticated Supabase user can create a new reminder based on their subscription plan. Free users SHALL be limited to 5 active reminders. Premium users SHALL have unlimited reminders.

#### Scenario: Free user under the limit is allowed

```gherkin
Given a free-plan user with 3 pending reminders
When the extension calls POST /functions/v1/check-reminder-limit with a valid Supabase JWT and pending_count = 3
Then the backend returns { allowed: true, limit: 5, current_count: 3 }
```

#### Scenario: Free user at the limit is blocked

```gherkin
Given a free-plan user with 5 pending reminders
When the extension calls POST /functions/v1/check-reminder-limit with a valid Supabase JWT and pending_count = 5
Then the backend returns { allowed: false, limit: 5, current_count: 5 }
```

#### Scenario: Premium user is always allowed

```gherkin
Given a premium-plan user with any number of pending reminders
When the extension calls POST /functions/v1/check-reminder-limit with a valid Supabase JWT and any pending_count
Then the backend returns { allowed: true, limit: -1, current_count: <reported_count> }
```

#### Scenario: Unauthenticated request is rejected

```gherkin
Given a request without a valid Supabase JWT
When POST /functions/v1/check-reminder-limit is called
Then the backend returns HTTP 401
And reminder creation is not authorized
```

### Requirement: Backend SHALL derive plan type from subscriptions table only

The backend SHALL determine a user's plan type by querying the `subscriptions` table for the authenticated user. The `user_profiles.plan_type` column SHALL be removed. If no qualifying subscription exists, the user SHALL be treated as free.

#### Scenario: User with active premium subscription

```gherkin
Given a user whose subscriptions record has plan_type = "premium" and status = "active"
When the backend checks the user's plan
Then the user is treated as premium with reminder_limit = -1
```

#### Scenario: User with trial premium subscription

```gherkin
Given a user whose subscriptions record has plan_type = "premium" and status = "trial"
When the backend checks the user's plan
Then the user is treated as premium with reminder_limit = -1
```

#### Scenario: User with no subscription record

```gherkin
Given a user with no record in the subscriptions table
When the backend checks the user's plan
Then the user is treated as free with reminder_limit = 5
```

#### Scenario: User with cancelled subscription

```gherkin
Given a user whose subscriptions record has status = "cancelled" (not "cancelled_pending")
When the backend checks the user's plan
Then the user is treated as free with reminder_limit = 5
```

#### Scenario: User with cancelled_pending subscription

```gherkin
Given a user whose subscriptions record has status = "cancelled_pending"
When the backend checks the user's plan
Then the user is treated as premium with reminder_limit = -1
Because they retain access until the current billing period ends
```

### Requirement: Extension SHALL call backend before creating reminders

The extension's `ReminderService.createReminder()` flow SHALL call the backend `check-reminder-limit` endpoint before persisting a new reminder. If the backend denies creation, the extension SHALL show an upgrade prompt and NOT create the reminder.

#### Scenario: Backend allows reminder creation

```gherkin
Given the user submits a new reminder
When the extension calls check-reminder-limit and receives { allowed: true }
Then the extension proceeds to create and persist the reminder locally
And schedules the Chrome alarm
```

#### Scenario: Backend denies reminder creation

```gherkin
Given a free user submits a new reminder when at the limit
When the extension calls check-reminder-limit and receives { allowed: false, limit: 5 }
Then the extension does NOT create the reminder
And displays an upgrade prompt with the message about the 5-reminder limit
```

#### Scenario: Backend is unreachable during reminder creation

```gherkin
Given the user submits a new reminder but the backend is unreachable
When the extension fails to reach check-reminder-limit
Then the extension applies conservative fallback enforcement
And does NOT grant premium unlimited reminders based on unverifiable local state alone
```

### Requirement: Unauthenticated users SHALL NOT receive premium entitlement decisions

The backend SHALL require an authenticated Supabase user context for premium entitlement checks.

#### Scenario: Missing session blocks entitlement lookup

```gherkin
Given the extension has no valid Supabase session
When it attempts to call check-reminder-limit
Then the backend returns HTTP 401
And the extension does not treat the user as verified premium
```
