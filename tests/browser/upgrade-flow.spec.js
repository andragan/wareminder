const { test, expect } = require("@playwright/test");
const path = require("path");

const popupUrl = `file://${path.resolve(__dirname, "../../src/popup/popup.html")}`;

async function setMockState(page, state) {
    await page.evaluate((nextState) => {
        window.__mockState = {
            ...window.__mockState,
            ...nextState,
        };
    }, state);
}

async function refreshPopup(page) {
    await page.evaluate(() => window.WAReminder.popup.loadReminders());
    await page.waitForTimeout(100);
}

test.describe("User Story 1: Upgrade Flow - Discover and Complete Upgrade", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const state = {
                reminders: [],
                planStatus: { isPremium: false, plan_type: "free" },
                checkoutResponse: {
                    success: true,
                    data: { checkoutUrl: "https://checkout.example.com/test" },
                },
                checkoutError: null,
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

        await page.goto(popupUrl);
    });

    test("shows upgrade prompt for free user at 5 pending reminders", async ({
        page,
    }) => {
        const reminders = Array.from({ length: 5 }, (_, i) => ({
            id: `r${i}`,
            chatId: `1111111111-${i}@c.us`,
            chatName: `Contact ${i}`,
            scheduledTime: Date.now() + (i + 1) * 60 * 60 * 1000,
            status: "pending",
        }));

        await setMockState(page, {
            reminders,
            planStatus: { isPremium: false, plan_type: "free" },
        });
        await refreshPopup(page);

        await expect(page.locator("#upgrade-prompt")).toBeVisible();
        await expect(page.locator("#reminder-list")).toBeHidden();
        await expect(page.locator("#upgrade-button")).toBeVisible();
        await expect(page.locator("#upgrade-error")).toBeHidden();
    });

    test("hides upgrade prompt for premium user and shows account settings", async ({
        page,
    }) => {
        const reminders = Array.from({ length: 6 }, (_, i) => ({
            id: `r${i}`,
            chatId: `1111111111-${i}@c.us`,
            chatName: `Contact ${i}`,
            scheduledTime: Date.now() + (i + 1) * 60 * 60 * 1000,
            status: "pending",
        }));

        await setMockState(page, {
            reminders,
            planStatus: { isPremium: true, plan_type: "premium" },
        });
        await refreshPopup(page);

        await expect(page.locator("#upgrade-prompt")).toBeHidden();
        await expect(page.locator("#premium-badge")).toBeVisible();
    });

    test("shows payment error when checkout initiation fails", async ({
        page,
    }) => {
        const reminders = Array.from({ length: 5 }, (_, i) => ({
            id: `r${i}`,
            chatId: `1111111111-${i}@c.us`,
            chatName: `Contact ${i}`,
            scheduledTime: Date.now() + (i + 1) * 60 * 60 * 1000,
            status: "pending",
        }));

        await setMockState(page, {
            reminders,
            planStatus: { isPremium: false, plan_type: "free" },
            checkoutError: "Payment gateway error",
        });
        await refreshPopup(page);

        await page.click("#upgrade-button");

        await expect(page.locator("#upgrade-error")).toBeVisible();
        await expect(page.locator("#upgrade-error-message")).toContainText(
            "Payment gateway error",
        );
        await expect(page.locator("#upgrade-button")).toBeHidden();
    });

    test("opens checkout tab when upgrade succeeds", async ({ page }) => {
        const reminders = Array.from({ length: 5 }, (_, i) => ({
            id: `r${i}`,
            chatId: `1111111111-${i}@c.us`,
            chatName: `Contact ${i}`,
            scheduledTime: Date.now() + (i + 1) * 60 * 60 * 1000,
            status: "pending",
        }));

        await setMockState(page, {
            reminders,
            planStatus: { isPremium: false, plan_type: "free" },
            checkoutError: null,
            checkoutResponse: {
                success: true,
                data: { checkoutUrl: "https://checkout.example.com/test" },
            },
        });
        await refreshPopup(page);

        await page.click("#upgrade-button");

        const tabsCreated = await page.evaluate(() => window.__tabsCreated);
        expect(tabsCreated).toHaveLength(1);
        expect(tabsCreated[0].url).toBe("https://checkout.example.com/test");
    });
});
