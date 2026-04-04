## 1. Subscription State Contract

- [x] 1.1 Update popup plan-status normalization so cached `subscriptionStatus` is the premium source of truth and the popup contract exposes consistent `planType` and `isPremium` fields.
- [x] 1.2 Add service worker message handlers for silent subscription refresh and interactive auth recovery using shared subscription sync logic.
- [x] 1.3 Return structured sync outcomes that distinguish successful refresh, auth-required recovery, and non-auth refresh failures.

## 2. Popup State And Recovery UX

- [x] 2.1 Update popup initialization to render from cached state first, trigger silent background subscription refresh, and rerender when subscription storage changes.
- [x] 2.2 Add popup auth recovery UI, styling, and localized copy for likely premium users whose silent verification cannot authenticate.
- [x] 2.3 Enforce popup state precedence so verified premium suppresses upgrade prompts and auth recovery suppresses upgrade prompts when premium access is likely but unverified.

## 3. Regression Coverage

- [x] 3.1 Extend browser Chrome mocks to simulate cached premium state, silent auth failure, and interactive auth recovery outcomes.
- [x] 3.2 Add browser tests covering immediate premium rendering, background refresh updates, auth recovery hint visibility, successful recovery, failed recovery, and free-user fallback behavior.
- [x] 3.3 Run targeted browser tests and affected validation checks for the popup subscription flow.