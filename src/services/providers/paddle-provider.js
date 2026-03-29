// @ts-check
/**
 * Paddle Payment Provider
 * Implements the payment provider interface using Paddle Billing.
 * @module providers/paddle-provider
 */

import { SUPABASE_CONFIG } from "../../lib/constants.js";

/**
 * Initiate a Paddle hosted checkout session for premium upgrade.
 * @returns {Promise<string|null>} Checkout URL or null on error
 */
export async function initiateCheckout() {
    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication required for checkout");
        }

        const response = await fetch(
            `${SUPABASE_CONFIG.URL}/functions/v1/create-paddle-checkout`,
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

        const { checkoutUrl } = await response.json();
        if (!checkoutUrl) {
            throw new Error("No checkout URL returned from server");
        }

        chrome.tabs.create({ url: checkoutUrl });
        setupCheckoutListener();

        return checkoutUrl;
    } catch (error) {
        console.error("Error initiating Paddle checkout:", error);
        return null;
    }
}

/**
 * Open the Paddle customer portal in a new tab.
 * The unauthenticated portal entry point — customers log in with their email.
 * @param {string} _userId - Unused; kept for interface compatibility
 * @returns {Promise<boolean>} True if portal opened successfully
 */
export async function redirectToCustomerPortal(_userId) {
    try {
        chrome.tabs.create({ url: "https://customer-portal.paddle.com/" });
        return true;
    } catch (error) {
        console.error("Error opening Paddle customer portal:", error);
        return false;
    }
}

/**
 * Handle successful Paddle transaction.
 * @param {string} transactionId - Paddle transaction ID
 * @returns {Promise<boolean>} True if handled successfully
 */
export async function handleCheckoutSuccess(transactionId) {
    try {
        if (!transactionId) {
            throw new Error("Transaction ID required for payment confirmation");
        }

        await chrome.storage.local.set({
            subscriptionStatus: {
                plan_type: "premium",
                status: "trial",
                transaction_id: transactionId,
                last_synced_at: new Date().toISOString(),
            },
        });

        console.info(
            "Paddle transaction initiated, subscription will activate upon webhook confirmation",
        );
        return true;
    } catch (error) {
        console.error("Error handling Paddle payment success:", error);
        return false;
    }
}

/**
 * Check whether the Paddle provider is configured.
 * @returns {boolean}
 */
export function isConfigured() {
    return !!SUPABASE_CONFIG.URL;
}

// --- Private helpers ---

function setupCheckoutListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "CHECKOUT_PAID") {
            handleCheckoutSuccess(message.transactionId);
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
