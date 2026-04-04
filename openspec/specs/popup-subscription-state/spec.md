# popup-subscription-state Specification

## Purpose
TBD - created by archiving change fix-popup-premium-auth-refresh. Update Purpose after archive.
## Requirements
### Requirement: Popup premium state SHALL be derived from cached subscription status
The popup SHALL determine whether to show premium account UI from cached subscription status when that data is available. Legacy local plan data MUST only act as a fallback when no cached subscription evidence exists.

#### Scenario: Cached premium subscription shows premium UI immediately
- **WHEN** the popup opens and cached subscription status indicates a premium plan
- **THEN** the popup shows premium account state without waiting for a network refresh

#### Scenario: No premium evidence falls back to free-tier UI
- **WHEN** the popup opens and no cached premium subscription evidence exists
- **THEN** the popup uses free-tier plan state and does not show premium-only account UI

### Requirement: Popup SHALL refresh subscription status in the background on open
The popup SHALL trigger a silent subscription refresh after initial rendering without blocking the initial popup paint. Updated subscription data MUST refresh popup account state when the background sync completes.

#### Scenario: Silent refresh upgrades cached popup state
- **WHEN** the popup opens with non-premium cached state and the silent refresh returns a premium subscription
- **THEN** the popup updates to premium account UI after the refreshed subscription state is stored

#### Scenario: Silent refresh failure preserves initial render
- **WHEN** the popup opens and the silent refresh does not complete successfully
- **THEN** the popup preserves the initial rendered state instead of showing a loading failure in place of normal content

### Requirement: Popup SHALL show auth recovery only for likely premium users
The popup SHALL display an auth recovery hint only when silent subscription verification cannot authenticate and cached data indicates the user is likely entitled to premium access.

#### Scenario: Cached premium plus silent auth failure shows recovery hint
- **WHEN** cached subscription state indicates premium access and silent subscription refresh fails because authentication is unavailable
- **THEN** the popup shows a sign-in recovery hint instead of the upgrade prompt

#### Scenario: Free user silent auth failure shows no recovery hint
- **WHEN** no cached premium evidence exists and silent subscription refresh cannot authenticate
- **THEN** the popup continues to show normal free-tier UI without a sign-in prompt

### Requirement: Popup SHALL support interactive auth recovery from the hint
The popup SHALL provide a recovery action that triggers interactive Google authentication and retries subscription verification. Successful recovery MUST replace the hint with the verified popup account state, and unsuccessful recovery MUST leave the hint available for retry.

#### Scenario: Interactive recovery restores premium account state
- **WHEN** a likely premium user completes the recovery sign-in flow successfully
- **THEN** the popup retries subscription verification and updates to verified premium UI

#### Scenario: Interactive recovery failure leaves retryable hint
- **WHEN** a likely premium user dismisses or fails the recovery sign-in flow
- **THEN** the popup keeps the recovery hint visible and available for another attempt

### Requirement: Popup SHALL apply a single account-state precedence model
The popup SHALL not present conflicting premium, free-tier upgrade, and auth-recovery states at the same time. Verified premium state MUST take precedence over upgrade messaging, and auth recovery MUST take precedence over upgrade messaging when premium access is likely but unverified.

#### Scenario: Verified premium suppresses upgrade prompt
- **WHEN** the popup has verified premium state and the user has more than the free reminder limit
- **THEN** the popup shows premium account UI and does not show the upgrade prompt

#### Scenario: Recovery state suppresses upgrade prompt for likely premium users
- **WHEN** the popup cannot verify a likely premium user because silent authentication failed
- **THEN** the popup shows the auth recovery hint and does not show the upgrade prompt until verification succeeds or premium evidence disappears

