const { test, expect } = require("@playwright/test");
const { setupChromeMock } = require("./helpers/chrome-mock-setup");
const { popupUrl } = require("./helpers/paths");

/**
 * Popup Subscription Flow Tests
 *
 * These tests cover the account-state precedence model and auth recovery hint
 * behavior as defined in the popup-subscription-state spec.
 *
 * ENVIRONMENT NOTE: popup.js uses ES modules (import/export) which do not load
 * reliably from file:// URLs in Playwright Chromium. As a result, popup
 * initialization does not run and `window.WAReminder.popup` is undefined.
 * All tests in this file are marked with test.fixme() until the test harness
 * supports ES module loading (e.g. via a local HTTP server or extension context).
 *
 * MANUAL TESTING PLAN (run in a real browser with the extension loaded):
 *
 * 1. Auth recovery hint — non-standard subscription status
 *    Setup: chrome.storage.local has subscriptionStatus = { planType: "free", status: "grace_period" }
 *    Expected: #auth-recovery-hint is visible, #upgrade-prompt is hidden, #account-settings is hidden
 *
 * 2. Auth recovery hint — null/missing subscription status
 *    Setup: chrome.storage.local has no subscriptionStatus entry (or status is null/undefined)
 *    Expected: #auth-recovery-hint is visible, #upgrade-prompt is hidden
 *
 * 3. No auth recovery hint — free user with active status
 *    Setup: subscriptionStatus = { planType: "free", status: "active" }; < 5 pending reminders
 *    Expected: #auth-recovery-hint is hidden, #upgrade-prompt is hidden, normal reminder list shown
 *
 * 4. No auth recovery hint — free user with cancelled_pending status
 *    Setup: subscriptionStatus = { planType: "free", status: "cancelled_pending" }; < 5 pending reminders
 *    Expected: #auth-recovery-hint is hidden, #upgrade-prompt is hidden, normal reminder list shown
 *
 * 5. Premium user — badge and account settings visible
 *    Setup: subscriptionStatus = { planType: "premium", status: "active" }
 *    Expected: #premium-badge is visible, #account-settings is visible, #upgrade-prompt is hidden,
 *              #auth-recovery-hint is hidden
 *
 * 6. Free user at limit — upgrade prompt visible
 *    Setup: subscriptionStatus = { planType: "free", status: "active" }; 5 pending reminders
 *    Expected: #upgrade-prompt is visible, #auth-recovery-hint is hidden
 *
 * 7. Auth recovery — successful sign-in
 *    Action: Click #auth-recovery-btn while hint is showing
 *    Expected: interactive auth recovery message sent to service worker; on success, popup reloads
 *              to show updated premium/free state with hint hidden
 *
 * 8. Auth recovery — cancelled sign-in
 *    Action: Click #auth-recovery-btn and cancel auth
 *    Expected: #auth-recovery-hint remains visible for retry
 */

// Skip all popup flow tests until ES module loading is supported from file:// in test harness
test.describe.skip("Popup Subscription Flow (requires extension test harness)", () => {
    test("should render premium account settings immediately when cached premium", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[PREMIUM-CACHED]",
            isPremium: true,
            reminderCount: 3,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "active",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#premium-badge")).toBeVisible();
        await expect(page.locator("#account-settings")).toBeVisible();
        await expect(page.locator("#upgrade-prompt")).not.toBeVisible();
    });

    test("should show auth recovery hint for non-premium user with non-standard subscription status", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[AUTH-RECOVERY-NON-STANDARD]",
            isPremium: false,
            reminderCount: 2,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "grace_period",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#auth-recovery-hint")).toBeVisible();
        await expect(page.locator("#upgrade-prompt")).not.toBeVisible();
        await expect(page.locator("#account-settings")).not.toBeVisible();
    });

    test("should show auth recovery hint when subscription status is null/undefined", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[AUTH-RECOVERY-NULL]",
            isPremium: false,
            reminderCount: 2,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: null,
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#auth-recovery-hint")).toBeVisible();
        await expect(page.locator("#upgrade-prompt")).not.toBeVisible();
    });

    test("should NOT show auth recovery hint for free user with active status", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[FREE-ACTIVE]",
            isPremium: false,
            reminderCount: 2,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "active",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#auth-recovery-hint")).not.toBeVisible();
    });

    test("should NOT show auth recovery hint for free user with cancelled_pending status", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[FREE-CANCELLED-PENDING]",
            isPremium: false,
            reminderCount: 2,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "cancelled_pending",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#auth-recovery-hint")).not.toBeVisible();
    });

    test("should show upgrade prompt for free user with active status at reminder limit", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[UPGRADE-PROMPT]",
            isPremium: false,
            reminderCount: 5,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "active",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#upgrade-prompt")).toBeVisible();
        await expect(page.locator("#auth-recovery-hint")).not.toBeVisible();
    });

    test("verified premium suppresses upgrade prompt even at reminder limit", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[PREMIUM-SUPPRESSES]",
            isPremium: true,
            reminderCount: 10,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "active",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() => typeof window.WAReminder?.popup !== "undefined");

        await expect(page.locator("#account-settings")).toBeVisible();
        await expect(page.locator("#upgrade-prompt")).not.toBeVisible();
        await expect(page.locator("#premium-badge")).toBeVisible();
    });

    test("should trigger silent subscription refresh on popup open", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupChromeMock(page, {
            prefix: "[SILENT-REFRESH]",
            isPremium: false,
            reminderCount: 3,
            silentRefreshOutcome: "refreshed",
            subscriptionStatus: "active",
        });
        await page.goto(popupUrl);
        await page.waitForFunction(() =>
            (window.__flowState?.messagesReceived || []).some(
                (m) => m && m.type === "SILENT_REFRESH_SUBSCRIPTION"
            )
        );
        const messages = await page.evaluate(() => window.__flowState?.messagesReceived || []);
        expect(messages.some((m) => m && m.type === "SILENT_REFRESH_SUBSCRIPTION")).toBe(true);
    });
});
