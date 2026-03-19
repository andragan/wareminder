// @ts-check
/**
 * Payment Service
 * Manages Stripe integration: checkout session creation, customer portal access
 * @module payment-service
 */

/**
 * Initiate Stripe checkout session for premium upgrade
 * Opens Stripe checkout URL in new tab/window
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Checkout session URL or null on error
 */
export async function initiateCheckout(userId) {
  try {
    if (!userId) {
      throw new Error('User ID required to initiate checkout');
    }

    // Get auth token
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required for checkout');
    }

    // Call backend to create Stripe checkout session
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Checkout session creation failed: ${response.status}`);
    }

    const { sessionUrl } = await response.json();
    if (!sessionUrl) {
      throw new Error('No session URL returned from server');
    }

    // Open checkout in new tab
    chrome.tabs.create({ url: sessionUrl });

    // Listen for checkout completion
    setupCheckoutListener(userId);

    return sessionUrl;
  } catch (error) {
    console.error('Error initiating checkout:', error);
    return null;
  }
}

/**
 * Redirect user to Stripe customer portal
 * Opens billing and subscription management in new tab
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if portal opened successfully
 */
export async function redirectToCustomerPortal(userId) {
  try {
    if (!userId) {
      throw new Error('User ID required to access portal');
    }

    // Get auth token
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    // Call backend to create portal session
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/create-portal-session`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Portal session creation failed: ${response.status}`);
    }

    const { portalUrl } = await response.json();
    if (!portalUrl) {
      throw new Error('No portal URL returned from server');
    }

    // Open portal in new tab
    chrome.tabs.create({ url: portalUrl });

    return true;
  } catch (error) {
    console.error('Error accessing customer portal:', error);
    return false;
  }
}
    console.error('Error accessing account:', error);
    return false;
  }
}

/**
 * Handle successful invoice payment
 * Called when Xendit invoice is paid and subscription is activated
 * @param {string} userId - User ID
 * @param {string} invoiceId - Xendit invoice ID
 * @returns {Promise<boolean>} True if handled successfully
 */
export async function handleCheckoutSuccess(userId, invoiceId) {
  try {
    if (!userId || !invoiceId) {
      throw new Error('User ID and invoice ID required for payment confirmation');
    }

    // Update local cache with new subscription status
    // Invoice payment will be processed by Xendit webhook
    await chrome.storage.local.set({
      subscriptionStatus: {
        plan_type: 'premium',
        status: 'trial',
        invoice_id: invoiceId,
        last_synced_at: new Date().toISOString(),
      },
    });

    console.info('Invoice payment initiated, subscription will activate upon payment');
    return true;
  } catch (error) {
    console.error('Error handling payment success:', error);
    return false;
  }
}

/**
 * Setup listener for invoice payment completion
 * @param {string} userId - User ID
 */
function setupInvoiceListener(userId) {
  // Listen for messages from service worker about invoice payment
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INVOICE_PAID') {
      handleCheckoutSuccess(userId, message.invoiceId);
      sendResponse({ success: true });
    }
  });
}

/**
 * Helper: Get auth token from Chrome identity API
 * @returns {Promise<string|null>} Auth token or null
 */
async function getAuthToken() {
  return new Promise((resolve) => {
    // @ts-ignore - Chrome API
    chrome.identity?.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get auth token:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(token || null);
      }
    });
  });
}

/**
 * Validate Xendit configuration is available
 * @returns {boolean} True if Xendit is configured
 */
export function isStripeConfigured() {
  return !!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
}
