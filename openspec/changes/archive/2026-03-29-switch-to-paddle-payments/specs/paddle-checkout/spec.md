## ADDED Requirements

### Requirement: Initiate Paddle checkout session
The system SHALL call the `create-paddle-checkout` Supabase Edge Function with a valid user auth token, receive a Paddle hosted checkout URL, and open it in a new Chrome tab.

#### Scenario: Successful checkout initiation
- **WHEN** the user clicks the upgrade button in the popup
- **THEN** the extension calls `create-paddle-checkout` with the user's auth token
- **THEN** the Edge Function returns `{ checkoutUrl: string }`
- **THEN** the extension opens `checkoutUrl` in a new tab using `chrome.tabs.create`

#### Scenario: Auth token unavailable
- **WHEN** `chrome.identity.getAuthToken` fails or returns null
- **THEN** `initiateCheckout()` returns `null` without calling the Edge Function

#### Scenario: Edge Function returns error
- **WHEN** the Edge Function responds with a non-2xx status
- **THEN** `initiateCheckout()` returns `null` and logs the error

#### Scenario: No checkout URL in response
- **WHEN** the Edge Function responds with 200 but `checkoutUrl` is absent
- **THEN** `initiateCheckout()` returns `null` and logs the error

### Requirement: Create Paddle checkout session server-side
The `create-paddle-checkout` Edge Function SHALL authenticate the caller, resolve the user's Supabase profile, and create a Paddle Billing checkout session using the configured price ID.

#### Scenario: Successful session creation
- **WHEN** a POST request arrives with a valid Bearer token
- **THEN** the function resolves the user's email from the Google OAuth token
- **THEN** the function looks up or creates the user profile in `user_profiles`
- **THEN** the function calls the Paddle API to create a checkout session for `PADDLE_PRICE_ID`
- **THEN** the function returns `{ checkoutUrl: string }` with HTTP 200

#### Scenario: Missing or invalid auth token
- **WHEN** a POST request arrives without an `Authorization` header or with an invalid token
- **THEN** the function returns HTTP 401

#### Scenario: Paddle API error
- **WHEN** the Paddle API returns an error during checkout session creation
- **THEN** the function returns HTTP 500 with an error message

### Requirement: PAYMENT_PROVIDER constant controls active provider
The extension SHALL expose a `PAYMENT_PROVIDER` constant in `src/lib/constants.js`. `payment-service.js` SHALL read this constant and delegate all checkout calls to the matching provider (`"paddle"` or `"xendit"`). Changing the constant SHALL switch the active provider with no other code changes required.

#### Scenario: Paddle selected
- **WHEN** `PAYMENT_PROVIDER` is `"paddle"`
- **THEN** `initiateCheckout()` calls the Paddle provider, which calls `create-paddle-checkout`

#### Scenario: Xendit selected
- **WHEN** `PAYMENT_PROVIDER` is `"xendit"`
- **THEN** `initiateCheckout()` calls the Xendit provider, which calls `create-xendit-invoice`

### Requirement: Provider interface contract
All payment providers SHALL implement the same interface: `initiateCheckout()`, `redirectToCustomerPortal(userId)`, `handleCheckoutSuccess(transactionId)`, and `isConfigured()`. Each provider SHALL live in `src/services/providers/<provider-name>-provider.js`.

#### Scenario: Provider modules are interchangeable
- **WHEN** `PAYMENT_PROVIDER` is changed from one valid provider name to another
- **THEN** `payment-service.js` delegates correctly to the new provider without any modifications to the service worker or popup code
