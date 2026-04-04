## Context

The popup currently determines premium state from plan data that can remain at the default free tier even when cached subscription data already indicates a paid account. At the same time, popup initialization does not reliably trigger a background refresh path that can reconcile stale subscription data without blocking the user interface. The change crosses popup rendering, plan normalization, service worker messaging, and subscription sync behavior, so the design needs a single contract for premium detection and auth recovery.

## Goals / Non-Goals

**Goals:**
- Make cached subscription state the popup source of truth for premium visibility.
- Keep popup startup fast by rendering from cached state first and refreshing in the background.
- Add an explicit recovery path for likely premium users when silent authentication fails.
- Prevent popup state conflicts between premium UI, upgrade prompts, and auth recovery messaging.
- Add automated regression coverage for the new popup behaviors.

**Non-Goals:**
- Redesign checkout, subscription purchase, or Supabase account creation flows.
- Require free users to authenticate when opening the popup.
- Replace the existing background subscription sync alarm mechanism.
- Introduce a new account model beyond the current Google identity to Supabase subscription mapping.

## Decisions

### Cached subscription status is the popup premium source of truth
The popup plan contract will be normalized from cached `subscriptionStatus` and only fall back to legacy `userPlan` data when no premium evidence exists. This matches existing reminder-limit enforcement, which already consults subscription-aware account logic, and avoids keeping two independent premium sources in sync.

Alternative considered: updating `userPlan` during subscription sync and continuing to treat it as canonical. This was rejected because it preserves duplicate state and still leaves the popup vulnerable to mismatched fields and stale writes.

### Popup refresh is non-blocking and message-driven
Popup initialization will render immediately from cached data, then trigger a service worker message that performs a silent subscription refresh. The popup will react to subscription storage changes or structured sync responses rather than waiting for the refresh before painting the interface.

Alternative considered: awaiting subscription verification before rendering the popup. This was rejected because it slows popup startup, increases sensitivity to service-worker startup timing, and makes transient auth issues feel like a broken popup.

### Silent refresh and interactive recovery use separate message paths
The service worker will expose one message path for silent background refresh and a second path for interactive auth recovery initiated by the popup hint. Silent refresh remains safe for normal popup startup, while interactive recovery is only used when there is evidence the user should have premium access.

Alternative considered: overloading a single sync message with optional interactive behavior. This was rejected because it blurs intent, complicates error handling, and risks prompting free users unnecessarily.

### Auth recovery hint is conditional and state-aware
The popup will show a sign-in recovery hint only when silent refresh fails to authenticate and cached state suggests the user is or was premium. Free users without premium evidence continue through the existing free-tier experience with no auth prompt.

Alternative considered: showing a sign-in prompt on any auth failure. This was rejected because most free users do not have a Supabase account and should not be pushed into authentication just to use the extension.

### Popup state precedence is explicit
Verified premium state wins over upgrade prompts. Auth recovery replaces account settings only when premium access is likely but currently unverified. Upgrade messaging remains available for ordinary free-tier users who hit the reminder limit.

Alternative considered: layering the auth hint on top of the existing upgrade prompt. This was rejected because it produces contradictory calls to action for likely premium users.

## Risks / Trade-offs

- [Stale cached premium state may briefly render before refresh downgrades it] → Mitigation: treat cached premium as an initial render optimization, then re-render immediately when silent refresh returns newer subscription data.
- [Interactive auth may be dismissed or fail repeatedly] → Mitigation: keep the recovery hint retryable and preserve the last known popup state instead of collapsing to a misleading free-tier account view.
- [Popup and service worker message contracts may drift] → Mitigation: normalize the plan-status response in one place and add browser coverage that exercises both silent refresh and interactive recovery paths.
- [Legacy `userPlan` data may still influence UI unexpectedly] → Mitigation: constrain `userPlan` to fallback behavior only and make `subscriptionStatus` the canonical premium signal for popup rendering.