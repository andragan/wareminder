const { test, expect } = require("@playwright/test");
const path = require("path");

const popupUrl = `file://${path.resolve(__dirname, "../../src/popup/popup.html")}`;

test.describe("Upgrade Flow - INITIATE_CHECKOUT Message", () => {
    test("should send properly formatted INITIATE_CHECKOUT message and open checkout URL", async ({
        page,
    }) => {
        // Track messages and state
        let sentMessages = [];
        let checkoutUrlOpened = null;

        await page.addInitScript(() => {
            window.__testState = {
                sentMessages: [],
                tabsCreated: [],
            };

            // Mock chrome API BEFORE popup.js loads
            window.chrome = {
                runtime: {
                    lastError: null,
                    sendMessage: (message, callback) => {
                        // Capture the message for verification
                        window.__testState.sentMessages.push({
                            timestamp: Date.now(),
                            message: JSON.parse(JSON.stringify(message)),
                        });

                        console.log(
                            "[TEST] sendMessage called:",
                            JSON.stringify(message)
                        );

                        // Route the message based on type
                        const type = message.type;

                        if (type === "GET_REMINDERS") {
                            // Return 5 reminders (triggers upgrade prompt for free user)
                            callback({
                                success: true,
                                data: {
                                    reminders: Array.from(
                                        { length: 5 },
                                        (_, i) => ({
                                            id: `r${i}`,
                                            chatId: `1111111111-${i}@c.us`,
                                            chatName: `Contact ${i}`,
                                            scheduledTime:
                                                Date.now() +
                                                (i + 1) * 60 * 60 * 1000,
                                            status: "pending",
                                        })
                                    ),
                                },
                            });
                        } else if (type === "GET_PLAN_STATUS") {
                            callback({
                                success: true,
                                data: {
                                    isPremium: false,
                                    plan_type: "free",
                                },
                            });
                        } else if (
                            type === "CHECK_NOTIFICATION_PERMISSION"
                        ) {
                            callback({
                                success: true,
                                data: { permissionLevel: "granted" },
                            });
                        } else if (type === "GET_CANCELLATION_STATUS") {
                            callback({
                                success: true,
                                data: { isCancelled: false },
                            });
                        } else if (type === "INITIATE_CHECKOUT") {
                            // This is the critical test—verify the message format
                            console.log(
                                "[TEST] CHECKOUT MESSAGE RECEIVED:",
                                JSON.stringify(message)
                            );

                            // Verify the message has required structure
                            if (!message.type || !message.payload) {
                                console.error(
                                    "[TEST] INVALID MESSAGE FORMAT:",
                                    message
                                );
                                callback({
                                    success: false,
                                    error: "Invalid message format",
                                });
                                return;
                            }

                            // Success response with checkout URL
                            console.log(
                                "[TEST] Responding with checkout URL"
                            );
                            callback({
                                success: true,
                                data: {
                                    checkoutUrl:
                                        "https://checkout.xendit.com/test-session-123",
                                },
                            });
                        } else {
                            console.warn("[TEST] Unknown message type:", type);
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
                            "[TEST] Tab created with URL:",
                            config.url
                        );
                        window.__testState.tabsCreated.push(config);
                        return Promise.resolve({ id: 999 });
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

        // Load the popup
        await page.goto(popupUrl);

        // Listen to console logs from the page
        page.on("console", (msg) => {
            if (msg.text().includes("[TEST]")) {
                console.log(msg.text());
            }
        });

        // Wait for popup to initialize
        await page.waitForTimeout(2000);

        // Manually make the upgrade prompt visible (it should be hidden until loadReminders is called)
        await page.evaluate(() => {
            const prompt = document.getElementById("upgrade-prompt");
            if (prompt && prompt.hasAttribute("hidden")) {
                prompt.removeAttribute("hidden");
            }
        });

        // Find and click the upgrade button
        const upgradeBtn = page.locator("#upgrade-button");
        const isVisible = await upgradeBtn.isVisible().catch(() => false);

        if (!isVisible) {
            console.log(
                "Upgrade button not visible, trying to make parent visible"
            );
            await page.evaluate(() => {
                const prompt = document.getElementById("upgrade-prompt");
                if (prompt) {
                    prompt.style.display = "block";
                    prompt.removeAttribute("hidden");
                }
                const btn = document.getElementById("upgrade-button");
                if (btn) {
                    btn.style.display = "block";
                    btn.removeAttribute("disabled");
                }
            });
        }

        // Click the upgrade button
        console.log("Clicking upgrade button...");
        await upgradeBtn.click();

        // Wait for the message to be processed
        await page.waitForTimeout(1000);

        // Extract sent messages from the page
        const messages = await page.evaluate(
            () => window.__testState.sentMessages
        );
        const tabs = await page.evaluate(() => window.__testState.tabsCreated);

        // Find the INITIATE_CHECKOUT message
        const checkoutMsg = messages.find(
            (m) => m.message.type === "INITIATE_CHECKOUT"
        );

        console.log("\n=== TEST RESULTS ===");
        console.log("All messages sent:", messages.map((m) => m.message.type));
        console.log(
            "Checkout message found:",
            checkoutMsg ? "YES" : "NO"
        );
        console.log("Tabs created:", tabs.map((t) => t.url));

        // Assertions
        if (!checkoutMsg) {
            console.error("✗ CHECKOUT MESSAGE NOT FOUND");
            console.error("Messages sent were:", messages);
            expect(checkoutMsg).toBeDefined();
            return;
        }

        console.log("✓ CHECKOUT MESSAGE FOUND:", checkoutMsg);

        // Verify message structure
        expect(checkoutMsg.message).toHaveProperty("type");
        expect(checkoutMsg.message).toHaveProperty("payload");
        expect(checkoutMsg.message.type).toBe("INITIATE_CHECKOUT");
        expect(checkoutMsg.message.payload).toBeDefined();

        // Verify checkout URL was opened
        expect(tabs.length).toBeGreaterThan(0);
        expect(tabs[0].url).toContain("checkout");

        console.log("✓ ALL ASSERTIONS PASSED");
    });
});

