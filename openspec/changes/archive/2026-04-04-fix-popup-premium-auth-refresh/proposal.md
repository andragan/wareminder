## Why

Premium users can open the extension popup and be treated like free users because the popup reads stale or incomplete local plan state and never reliably refreshes authenticated subscription data in the background. This causes subscription status to be missed at the exact point where premium affordances need to be shown, which undermines trust for paid users and makes account recovery ambiguous when silent authentication fails.

## What Changes

- Normalize popup plan status around cached subscription state instead of relying on legacy local plan data as the premium source of truth.
- Refresh subscription status in the background when the popup opens without blocking the initial popup render.
- Add a targeted popup auth recovery hint for likely premium users when silent subscription refresh cannot authenticate.
- Update popup rendering so premium badge, account settings, upgrade prompts, and auth recovery states do not conflict.
- Add regression coverage for popup subscription rendering, background refresh, and auth recovery flows.

## Capabilities

### New Capabilities
- `popup-subscription-state`: Defines how the popup determines premium status from cached subscription data, refreshes that status in the background, and guides likely premium users through auth recovery when verification fails.

### Modified Capabilities
None.

## Impact

- Affected code: popup UI state management, service worker message routing, subscription sync helpers, plan status normalization, and browser test mocks.
- Affected systems: Chrome identity authentication, cached subscription state in local storage, Supabase subscription verification, and popup UX for premium account visibility.
- Dependencies: existing Chrome identity permission and current background subscription sync flow are reused rather than replaced.