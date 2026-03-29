// @ts-check
/**
 * Xendit Payment Provider
 * Implements the payment provider interface using Xendit invoices.
 * @module providers/xendit-provider
 */

import { SUPABASE_CONFIG } from "../../lib/constants.js";

/**
 * Initiate Xendit invoice checkout session for premium upgrade.
 * @returns {Promise<string|null>} Invoice URL or null on error
 */
export async function initiateCheckout() {
    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication required for checkout");
        }

        const response = await fetch(
            `${SUPABASE_CONFIG.URL}/functions/v1/create-xendit-invoice`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Checkout session creation failed: ${response.status}`,
            );
        }

        const { invoiceUrl } = await response.json();
        if (!invoiceUrl) {
            throw new Error("No invoice URL returned from server");
        }

        chrome.tabs.create({ url: invoiceUrl });
        setupCheckoutListener();

        return invoiceUrl;
    } catch (error) {
        console.error("Error initiating Xendit checkout:", error);
        return null;
    }
}

/**
 * Redirect user to Xendit customer portal.
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if portal opened successfully
 */
export async function redirectToCustomerPortal(userId) {
    try {
        if (!userId) {
            throw new Error("User ID required to access portal");
        }

        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication required");
        }

        const response = await fetch(
            `${SUPABASE_CONFIG.URL}/functions/v1/get-subscription-status`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user_id: userId }),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Portal session creation failed: ${response.status}`,
            );
        }

        const { portalUrl } = await response.json();
        if (!portalUrl) {
            throw new Error("No portal URL returned from server");
        }

        chrome.tabs.create({ url: portalUrl });
        return true;
    } catch (error) {
        console.error("Error accessing Xendit customer portal:", error);
        return false;
    }
}

/**
 * Handle successful Xendit invoice payment.
 * @param {string} invoiceId - Xendit invoice ID
 * @returns {Promise<boolean>} True if handled successfully
 */
export async function handleCheckoutSuccess(invoiceId) {
    try {
        if (!invoiceId) {
            throw new Error("Invoice ID required for payment confirmation");
        }

        await chrome.storage.local.set({
            subscriptionStatus: {
                plan_type: "premium",
                status: "trial",
                invoice_id: invoiceId,
                last_synced_at: new Date().toISOString(),
            },
        });

        console.info(
            "Xendit invoice payment initiated, subscription will activate upon payment",
        );
        return true;
    } catch (error) {
        console.error("Error handling Xendit payment success:", error);
        return false;
    }
}

/**
 * Check whether the Xendit provider is configured.
 * @returns {boolean}
 */
export function isConfigured() {
    return !!SUPABASE_CONFIG.URL;
}

// --- Private helpers ---

function setupCheckoutListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "CHECKOUT_PAID") {
            handleCheckoutSuccess(message.invoiceId);
            sendResponse({ success: true });
        }
    });
}

/**
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
    return new Promise((resolve) => {
        // @ts-ignore - Chrome API
        chrome.identity?.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError) {
                console.error(
                    "Failed to get auth token:",
                    chrome.runtime.lastError,
                );
                resolve(null);
            } else {
                resolve(token || null);
            }
        });
    });
}
