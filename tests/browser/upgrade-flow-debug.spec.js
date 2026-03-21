const { test, expect } = require("@playwright/test");
const path = require("path");
const { setupChromeMock } = require("./helpers/chrome-mock-setup");

const popupUrl = `file://${path.resolve(__dirname, "../../src/popup/popup.html")}`;

test.describe("Upgrade Flow - INITIATE_CHECKOUT Message", () => {
    test("should send properly formatted INITIATE_CHECKOUT message and open checkout URL", async ({
        page,
    }) => {
        // Setup Chrome API mock with default free plan (5 reminders)
        await setupChromeMock(page, {
            prefix: "[TEST]",
            reminderCount: 5,
            checkoutUrl: "https://checkout.xendit.com/test-session-123",
        });

        // Add script to wrap sendMessage and capture messages for testing
        await page.addInitScript(() => {
            window.__testState = {
                sentMessages: [],
                tabsCreated: [],
            };
            const originalSendMessage = window.chrome.runtime.sendMessage;
            window.chrome.runtime.sendMessage = (message, callback) => {
                window.__testState.sentMessages.push({
                    timestamp: Date.now(),
                    message: JSON.parse(JSON.stringify(message)),
                });
                return originalSendMessage(message, callback);
            };
            const originalTabsCreate = window.chrome.tabs.create;
            window.chrome.tabs.create = (config) => {
                window.__testState.tabsCreated.push(config);
                return originalTabsCreate(config);
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

