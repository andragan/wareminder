// @ts-check
/**
 * Payment Service
 * Manages Xendit integration: invoice initiation, invoice payment handling
 * @module payment-service
 */

/**
 * Initiate Xendit invoice for premium upgrade
 * Opens Xendit invoice URL in new tab/window
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Invoice URL or null on error
 */
export async function initiateCheckout(userId) {
  try {
    if (!userId) {
      throw new Error('User ID required to initiate invoice');
    }

    // Get auth token
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required for invoice creation');
    }

    // Call backend to create Xendit invoice
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-xendit-invoice`,
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
      throw new Error(`Invoice creation failed: ${response.status}`);
    }

    const { invoiceUrl } = await response.json();
    if (!invoiceUrl) {
      throw new Error('No invoice URL returned from server');
    }

    // Open invoice in new tab
    chrome.tabs.create({ url: invoiceUrl });

    // Listen for invoice payment completion
    setupInvoiceListener(userId);

    return invoiceUrl;
  } catch (error) {
    console.error('Error initiating invoice:', error);
    return null;
  }
}

/**
 * Redirect user to Xendit support or invoice management
 * Opens invoice history or account page in new tab
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if portal opened successfully
 */
export async function redirectToCustomerPortal(userId) {
  try {
    if (!userId) {
      throw new Error('User ID required to access account');
    }

    // Xendit doesn't have a direct customer portal like Stripe
    // For now, open Xendit support or account page
    const xenditAccountUrl = 'https://xendit.com/account';
    
    chrome.tabs.create({ url: xenditAccountUrl });

    return true;
  } catch (error) {
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
  return !!process.env.REACT_APP_SUPABASE_URL;
}
