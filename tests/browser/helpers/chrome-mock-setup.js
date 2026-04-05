/**
 * Chrome API Mock Setup Helper
 *
 * Provides a reusable function to inject a mock Chrome API into Playwright test pages.
 * Supports customizable scenarios (free plan, premium, different reminder counts, etc.)
 */

/**
 * Setup Chrome API mock for Playwright page
 * @param {Object} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {boolean} options.isPremium - Whether user has premium plan (default: false)
 * @param {number} options.reminderCount - Number of reminders to return (default: 5)
 * @param {string} options.checkoutUrl - Checkout URL to return (default: xendit)
 * @param {boolean} options.isCancelled - Whether subscription is cancelled (default: false)
 * @param {string} options.permissionLevel - Notification permission level (default: 'granted')
 * @param {string} options.prefix - Log prefix for console messages (default: '[CHROME-MOCK]')
 * @param {string} options.silentRefreshOutcome - Outcome of silent refresh (default: 'refreshed') - can be 'refreshed', 'auth_required', 'sync_failed'
 * @param {string} options.subscriptionStatus - Raw subscription status returned by GET_PLAN_STATUS (default: 'active')
 * @param {boolean} options.interactiveAuthSucceeds - Whether interactive auth recovery succeeds (default: true)
 */
async function setupChromeMock(
    page,
    options = {}
) {
    const {
        isPremium = false,
        reminderCount = 5,
        checkoutUrl = "https://sandbox-checkout.paddle.com/checkout/session-123",
        isCancelled = false,
        permissionLevel = "granted",
        prefix = "[CHROME-MOCK]",
        silentRefreshOutcome = "refreshed",
        interactiveAuthSucceeds = true,
        subscriptionStatus = "active",
    } = options;

    await page.addInitScript(
        (config) => {
            const {
                isPremium,
                reminderCount,
                checkoutUrl,
                isCancelled,
                permissionLevel,
                prefix,
                silentRefreshOutcome,
                interactiveAuthSucceeds,
                subscriptionStatus,
            } = config;

            // Initialize flow state
            window.__flowState = {
                messagesReceived: [],
                checkoutUrlOpened: null,
                tabsCreated: [],
            };

            console.log(`${prefix} Setting up Chrome mock...`);

            // Mock Chrome API
            window.chrome = {
                runtime: {
                    lastError: null,
                    sendMessage: (message, callback) => {
                        console.log(`${prefix} Message received:`, message.type);
                        window.__flowState.messagesReceived.push(message);

                        const type = message.type;

                        if (type === "GET_REMINDERS") {
                            console.log(
                                `${prefix} Responding with ${reminderCount} reminders`
                            );
                            callback({
                                success: true,
                                data: {
                                    reminders: Array.from(
                                        { length: reminderCount },
                                        (_, i) => ({
                                            id: `reminder-${i}`,
                                            chatId: `111111-${i}@c.us`,
                                            chatName: `Chat ${i}`,
                                            scheduledTime:
                                                Date.now() +
                                                (i + 1) * 60 * 60 * 1000,
                                            status: "pending",
                                        })
                                    ),
                                },
                            });
                        } else if (type === "GET_PLAN_STATUS") {
                            console.log(
                                `${prefix} Responding with ${
                                    isPremium ? "premium" : "free"
                                } plan status, subscriptionStatus: ${subscriptionStatus}`
                            );
                            callback({
                                success: true,
                                data: {
                                    isPremium,
                                    plan_type: isPremium ? "premium" : "free",
                                    subscriptionStatus,
                                },
                            });
                        } else if (
                            type === "CHECK_NOTIFICATION_PERMISSION"
                        ) {
                            console.log(
                                `${prefix} Responding with permission:`,
                                permissionLevel
                            );
                            callback({
                                success: true,
                                data: { permissionLevel },
                            });
                        } else if (type === "GET_CANCELLATION_STATUS") {
                            console.log(
                                `${prefix} Responding with cancellation status:`,
                                isCancelled
                            );
                            callback({
                                success: true,
                                data: { isCancelled },
                            });
                        } else if (type === "GET_SUBSCRIPTION_DETAILS") {
                            console.log(
                                `${prefix} Responding with subscription details`
                            );
                            callback({
                                success: true,
                                data: {
                                    planType: isPremium ? "premium" : "free",
                                },
                            });
                        } else if (type === "INITIATE_CHECKOUT") {
                            console.log(
                                `${prefix} CRITICAL: checkout message received`
                            );

                            // Validate message format
                            if (
                                !message ||
                                !message.type ||
                                !message.payload
                            ) {
                                console.error(
                                    `${prefix} Invalid message format:`,
                                    message
                                );
                                callback({
                                    success: false,
                                    error: "Invalid message format",
                                });
                                return;
                            }

                            console.log(
                                `${prefix} Message format valid, returning checkout URL`
                            );
                            window.__flowState.checkoutUrlOpened = checkoutUrl;

                            callback({
                                success: true,
                                data: {
                                    checkoutUrl:
                                        window.__flowState.checkoutUrlOpened,
                                },
                            });
                        } else if (type === "SILENT_REFRESH_SUBSCRIPTION") {
                            console.log(
                                `${prefix} SILENT_REFRESH_SUBSCRIPTION: ${silentRefreshOutcome}`
                            );
                            callback({
                                success: true,
                                data: {
                                    outcome: silentRefreshOutcome,
                                },
                            });
                        } else if (type === "INTERACTIVE_AUTH_RECOVERY") {
                            console.log(
                                `${prefix} INTERACTIVE_AUTH_RECOVERY: ${interactiveAuthSucceeds ? "success" : "failure"}`
                            );
                            callback({
                                success: true,
                                data: {
                                    outcome: interactiveAuthSucceeds ? "recovered" : "auth_failed",
                                },
                            });
                        } else {
                            console.warn(
                                `${prefix} Unknown message type:`,
                                type
                            );
                            callback({
                                success: false,
                                error: `Unknown message type: ${type}`,
                            });
                        }
                    },
                    onMessage: {
                        addListener: () => {},
                        removeListener: () => {},
                    },
                    openOptionsPage: () => Promise.resolve(),
                },
                tabs: {
                    create: (config) => {
                        console.log(
                            `${prefix} Opening tab with URL:`,
                            config.url
                        );
                        window.__flowState.tabsCreated.push(config);
                        return Promise.resolve({ id: 99 });
                    },
                },
                storage: {
                    local: {
                        get: () => Promise.resolve({
                            subscriptionStatus: {
                                userId: "test-user-123",
                                planType: isPremium ? "premium" : "free",
                                status: subscriptionStatus,
                            },
                        }),
                        set: () => Promise.resolve(),
                    },
                    onChanged: {
                        addListener: () => {},
                    },
                },
                identity: {
                    getAuthToken: (config, callback) => {
                        console.log(`${prefix} getAuthToken called with interactive:`, config.interactive);
                        // Return a mock JWT for testing
                        const mockJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
                        callback(mockJWT);
                    },
                },
                i18n: {
                    getMessage: (key) => key,
                },
            };
        },
        {
            isPremium,
            reminderCount,
            checkoutUrl,
            isCancelled,
            permissionLevel,
            prefix,
            silentRefreshOutcome,
            interactiveAuthSucceeds,
            subscriptionStatus,
        }
    );
}

/**
 * Setup stateful Chrome API mock for Playwright page
 * Allows tests to dynamically modify mock state via setMockState()
 * @param {Object} page - Playwright page object
 */
async function setupChromeMockStateful(page) {
    await page.addInitScript(() => {
        const state = {
            reminders: [],
            planStatus: { isPremium: false, plan_type: "free" },
            checkoutResponse: {
                success: true,
                data: { checkoutUrl: "https://checkout.example.com/test" },
            },
            checkoutError: null,
            silentRefreshOutcome: "refreshed",
            interactiveAuthSucceeds: true,
        };

        window.__mockState = state;
        window.__tabsCreated = [];

        window.chrome = {
            runtime: {
                lastError: null,
                sendMessage: (message, callback) => {
                    const current = window.__mockState;

                    if (message.type === "GET_REMINDERS") {
                        callback({
                            success: true,
                            data: { reminders: current.reminders },
                        });
                        return;
                    }

                    if (message.type === "GET_PLAN_STATUS") {
                        callback({
                            success: true,
                            data: current.planStatus,
                        });
                        return;
                    }

                    if (message.type === "CHECK_NOTIFICATION_PERMISSION") {
                        callback({
                            success: true,
                            data: { permissionLevel: "granted" },
                        });
                        return;
                    }

                    if (message.type === "GET_CANCELLATION_STATUS") {
                        callback({
                            success: true,
                            data: { isCancelled: false },
                        });
                        return;
                    }

                    if (message.type === "INITIATE_CHECKOUT") {
                        if (current.checkoutError) {
                            callback({
                                success: false,
                                error: current.checkoutError,
                            });
                            return;
                        }
                        callback(current.checkoutResponse);
                        return;
                    }

                    if (message.type === "SILENT_REFRESH_SUBSCRIPTION") {
                        callback({
                            success: true,
                            data: { outcome: current.silentRefreshOutcome },
                        });
                        return;
                    }

                    if (message.type === "INTERACTIVE_AUTH_RECOVERY") {
                        callback({
                            success: true,
                            data: {
                                outcome: current.interactiveAuthSucceeds
                                    ? "recovered"
                                    : "auth_failed",
                            },
                        });
                        return;
                    }

                    callback({
                        success: false,
                        error: `Unknown message type: ${message.type}`,
                    });
                },
                onMessage: {
                    addListener: () => {},
                    removeListener: () => {},
                },
                openOptionsPage: () => Promise.resolve(),
            },
            tabs: {
                create: (payload) => {
                    window.__tabsCreated.push(payload);
                    return Promise.resolve();
                },
            },
            storage: {
                onChanged: {
                    addListener: () => {},
                },
            },
            i18n: {
                getMessage: (key) => key,
            },
        };
    });
}

module.exports = { setupChromeMock, setupChromeMockStateful };
