## MODIFIED Requirements

### Requirement: Popup premium state SHALL be derived from cached subscription status

The popup SHALL determine whether to show premium account UI from cached subscription status when that data is available. Legacy local plan data MUST only act as a fallback when no cached subscription evidence exists.

**Change:** The cached subscription status is now populated by `get-subscription-status` using a valid Supabase session. Popup init depends on session restore plus a background subscription refresh.

#### Scenario: Cached premium subscription shows premium UI immediately

```gherkin
Given the user has a cached subscriptionStatus with planType = "premium" from a prior authenticated subscription refresh
When the popup opens
Then the popup shows premium account state without waiting for a network refresh
```

#### Scenario: No premium evidence falls back to free-tier UI

```gherkin
Given no cached subscriptionStatus exists or cached planType = "free"
When the popup opens
Then the popup uses free-tier plan state and does not show premium-only account UI
```

### Requirement: Popup SHALL refresh subscription status in the background on open

The popup SHALL trigger a background subscription refresh via `get-subscription-status` after initial rendering without blocking the initial popup paint. Updated subscription data MUST refresh popup account state when the background call completes.

**Change:** Background refresh now depends on restoring or refreshing the Supabase session first, then calling `get-subscription-status` with the authenticated session.

#### Scenario: Silent refresh upgrades cached popup state

```gherkin
Given the popup opened with cached free-tier state
When the background get-subscription-status call returns a premium subscription
Then the subscriptionStatus cache is updated
And the popup re-renders to premium account UI
```

#### Scenario: Silent refresh failure preserves initial render

```gherkin
Given the popup opened with cached state
When the background get-subscription-status call fails (network error or server error)
Then the popup preserves the initial rendered state
And does NOT show a loading failure replacing normal content
```

### Requirement: Popup SHALL show auth recovery only for likely premium users

The popup SHALL display an auth recovery hint only when no valid Supabase session is available and cached data indicates the user is likely entitled to premium access.

**Change:** Auth recovery now means session restore/refresh failed and the user must complete an interactive Supabase sign-in again.

#### Scenario: Cached premium plus missing session shows recovery hint

```gherkin
Given cached subscriptionStatus indicates premium access
And no valid Supabase session can be restored silently
When the popup evaluates auth state
Then the popup shows a sign-in recovery hint instead of the upgrade prompt
```

#### Scenario: Free user missing session shows no recovery hint

```gherkin
Given no cached premium evidence exists
And no valid Supabase session can be restored silently
When the popup evaluates auth state
Then the popup continues to show normal free-tier UI without a sign-in prompt
```

### Requirement: Popup SHALL support interactive auth recovery from the hint

The popup SHALL provide a recovery action that triggers interactive Supabase sign-in and then refreshes subscription state. Successful recovery MUST replace the hint with the verified popup account state, and unsuccessful recovery MUST leave the hint available for retry.

**Change:** Recovery now restores a valid Supabase session and then calls `get-subscription-status`.

#### Scenario: Interactive recovery restores premium account state

```gherkin
Given a likely premium user clicks the recovery sign-in button
When the interactive Supabase sign-in flow succeeds
And get-subscription-status returns a premium subscription
Then the popup updates to verified premium UI
And the recovery hint is hidden
```

#### Scenario: Interactive recovery failure leaves retryable hint

```gherkin
Given a likely premium user clicks the recovery sign-in button
When the interactive Supabase sign-in flow fails or is cancelled
Then the popup keeps the recovery hint visible and available for another attempt
```

### Requirement: Popup SHALL apply a single account-state precedence model

The popup SHALL not present conflicting premium, free-tier upgrade, and auth-recovery states at the same time. Verified premium state MUST take precedence over upgrade messaging, and auth recovery MUST take precedence over upgrade messaging when premium access is likely but unverified.

**Change:** No behavioral change — this requirement is preserved as-is. The underlying data source changes to Supabase-session-backed subscription refreshes.

#### Scenario: Verified premium suppresses upgrade prompt

```gherkin
Given the popup has verified premium state from get-subscription-status
And the user has more than 5 active reminders
When the popup renders
Then the popup shows premium account UI
And does NOT show the upgrade prompt
```

#### Scenario: Recovery state suppresses upgrade prompt for likely premium users

```gherkin
Given the popup cannot verify a likely premium user because no valid Supabase session could be restored silently
When the popup renders
Then the popup shows the auth recovery hint
And does NOT show the upgrade prompt until verification succeeds or premium evidence disappears
```

### Requirement: Popup SHALL prompt sign-in for unauthenticated users

The popup SHALL show a sign-in prompt when the user has never signed in or has no restorable Supabase session. This is distinct from auth recovery (which is for users who previously had premium access).

#### Scenario: First-time user sees sign-in prompt

```gherkin
Given no cached subscriptionStatus exists
And no valid Supabase session can be restored
When the popup opens
Then the popup shows a "Sign in with Google" button
And reminder functionality remains available (free tier, local enforcement as fallback)
```

#### Scenario: User signs in for the first time

```gherkin
Given the popup is showing the sign-in prompt
When the user clicks "Sign in with Google"
Then the extension starts the interactive Supabase Google sign-in flow
And on success get-subscription-status is called
And the popup updates to reflect the user's plan (free for new users)
And the sign-in prompt is replaced with account state UI
```
