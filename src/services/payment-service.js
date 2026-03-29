// @ts-check
/**
 * Payment Service — Provider Router
 * Delegates all payment operations to the active provider selected by PAYMENT_PROVIDER.
 * To switch providers, change PAYMENT_PROVIDER in src/lib/constants.js.
 * @module payment-service
 */

import { PAYMENT_PROVIDER } from "../lib/constants.js";
import * as XenditProvider from "./providers/xendit-provider.js";
import * as PaddleProvider from "./providers/paddle-provider.js";

/**
 * Return the active payment provider module.
 * @returns {typeof XenditProvider}
 */
function getProvider() {
    switch (PAYMENT_PROVIDER) {
        case "paddle":
            return PaddleProvider;
        case "xendit":
            return XenditProvider;
        default:
            throw new Error(
                `Unknown PAYMENT_PROVIDER: "${PAYMENT_PROVIDER}". Expected "paddle" or "xendit".`,
            );
    }
}

/**
 * Initiate checkout session for premium upgrade.
 * @returns {Promise<string|null>} Checkout URL or null on error
 */
export async function initiateCheckout() {
    return getProvider().initiateCheckout();
}

/**
 * Redirect user to the provider's customer portal.
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if portal opened successfully
 */
export async function redirectToCustomerPortal(userId) {
    return getProvider().redirectToCustomerPortal(userId);
}

/**
 * Handle successful payment confirmation.
 * @param {string} transactionId - Provider transaction/invoice ID
 * @returns {Promise<boolean>} True if handled successfully
 */
export async function handleCheckoutSuccess(transactionId) {
    return getProvider().handleCheckoutSuccess(transactionId);
}

/**
 * Check whether the active payment provider is configured.
 * @returns {boolean}
 */
export function isPaymentConfigured() {
    return getProvider().isConfigured();
}

