/**
 * Manual Extension Loading Test
 * Run this locally to verify the extension loads without Chrome/Edge errors
 * 
 * Usage: node tests/browser/manual-extension-test.js
 * Usage with Edge: BROWSER=edge node tests/browser/manual-extension-test.js
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const extensionPath = path.join(__dirname, "../../src");
const tempProfile = path.join(__dirname, "../../.test-profile-temp");
const browserType = process.env.BROWSER || "chromium";

async function testExtensionLoad() {
    console.log(`🔍 Loading extension from: ${extensionPath}`);
    console.log(`📁 Using temp profile: ${tempProfile}`);
    console.log(`🌐 Browser: ${browserType.toUpperCase()}`);

    // Clean up old profile if it exists
    if (fs.existsSync(tempProfile)) {
        fs.rmSync(tempProfile, { recursive: true, force: true });
    }

    // Use Edge if available, otherwise Chromium
    const launchArgs = {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    };

    // Try to use Edge if requested
    if (browserType === "edge") {
        try {
            const { chromium: edge } = require("playwright");
            launchArgs.channel = "msedge";
        } catch (e) {
            console.log("⚠️  Edge not available, falling back to Chromium");
        }
    }

    const context = await chromium.launchPersistentContext(
        tempProfile,
        launchArgs,
    );

    console.log("✅ Browser launched with extension");

    const errors = [];
    const warnings = [];
    const allLogs = [];

    // Monitor all background pages for errors
    const monitorPage = (page, label) => {
        page.on("console", (msg) => {
            const type = msg.type();
            const text = msg.text();
            const logEntry = `[${label} ${type.toUpperCase()}] ${text}`;
            
            allLogs.push(logEntry);
            
            if (type === "error") {
                console.log(`❌ ${logEntry}`);
                errors.push(`${label}: ${text}`);
            } else if (type === "warning") {
                console.log(`⚠️  ${logEntry}`);
                warnings.push(`${label}: ${text}`);
            } else {
                console.log(`   ${logEntry}`);
            }
        });

        page.on("pageerror", (error) => {
            const msg = `${error.name}: ${error.message}`;
            console.log(`❌ [${label} PAGE ERROR] ${msg}`);
            console.log(`   Stack: ${error.stack}`);
            errors.push(`${label} PageError: ${msg}`);
            allLogs.push(`[${label} PAGE ERROR] ${msg}`);
        });
    };

    // Monitor initial background pages
    const backgroundPages = context.backgroundPages();
    console.log(`📄 Initial background pages: ${backgroundPages.length}`);
    backgroundPages.forEach((page, i) => {
        monitorPage(page, `BG${i}`);
    });

    // Create extensions page to check for registration errors
    console.log("🔍 Checking chrome://extensions for errors...");
    const extensionsPage = await context.newPage();
    await extensionsPage.goto("chrome://extensions/");
    await extensionsPage.waitForTimeout(2000);

    // Try to detect extension ID and check for errors
    try {
        const errorElements = await extensionsPage.locator('[role="button"][aria-label*="Errors"]').all();
        if (errorElements.length > 0) {
            console.log(`⚠️  Found ${errorElements.length} extension(s) with errors`);
            
            // Click on errors to see details
            for (const errorButton of errorElements) {
                try {
                    await errorButton.click();
                    await extensionsPage.waitForTimeout(500);
                    
                    // Capture error text if visible
                    const errorText = await extensionsPage.locator('.error-message').allTextContents();
                    if (errorText.length > 0) {
                        errorText.forEach(text => {
                            console.log("  Extension Error:", text);
                            errors.push(`Extension Page: ${text}`);
                        });
                    }
                } catch (e) {
                    // Ignore click errors
                }
            }
        }
    } catch (e) {
        console.log("  (Could not automatically check for errors on extensions page)");
    }

    await extensionsPage.close();

    // Create a test page and wait for service worker to fully initialize
    const page = await context.newPage();
    console.log("📖 Opened test page");

    // Try to trigger content scripts by visiting WhatsApp Web
    console.log("🌐 Navigating to WhatsApp Web to trigger content scripts...");
    try {
        // Monitor the page for content script errors
        monitorPage(page, "WhatsApp");
        
        await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded", timeout: 10000 });
        console.log("  ✅ WhatsApp Web loaded");
        
        // Give content scripts time to inject and execute
        await page.waitForTimeout(2000);
    } catch (e) {
        console.log("  ⚠️  Could not load WhatsApp Web:", e.message);
    }

    // Wait for extension to fully initialize including service worker
    console.log("⏳ Waiting 5 seconds for service worker to initialize...");
    await page.waitForTimeout(5000);

    // Check for new background pages after initialization
    const newBackgroundPages = context.backgroundPages();
    if (newBackgroundPages.length > backgroundPages.length) {
        console.log(`📄 New background pages detected: ${newBackgroundPages.length - backgroundPages.length}`);
        newBackgroundPages.forEach((bgPage, i) => {
            if (!backgroundPages.includes(bgPage)) {
                monitorPage(bgPage, `NewBG${i}`);
            }
        });
    }

    // Give a bit more time for any delayed errors
    await page.waitForTimeout(2000);

    // Test extension reload to catch reload-specific errors
    console.log("\n🔄 Testing extension reload...");
    const reloadPage = await context.newPage();
    await reloadPage.goto("chrome://extensions/");
    await reloadPage.waitForTimeout(1000);
    
    try {
        // Find and click the reload button (may need adjustment based on Chrome version)
        const reloadButton = reloadPage.locator('[aria-label*="Reload"]').first();
        if (await reloadButton.count() > 0) {
            await reloadButton.click();
            console.log("  Clicked reload button");
            await reloadPage.waitForTimeout(3000);
            
            // Check for errors after reload
            const errorElements = await reloadPage.locator('[role="button"][aria-label*="Errors"]').all();
            if (errorElements.length > 0) {
                console.log(`  ⚠️  Errors detected after reload: ${errorElements.length}`);
                for (const errorButton of errorElements) {
                    try {
                        await errorButton.click({ timeout: 1000 });
                        await reloadPage.waitForTimeout(500);
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        } else {
            console.log("  (Could not find reload button - manual check recommended)");
        }
    } catch (e) {
        console.log("  (Could not automatically test reload)");
    }
    
    await reloadPage.close();
    await page.waitForTimeout(2000);

    console.log("\n" + "=".repeat(60));
    if (errors.length === 0 && warnings.length === 0) {
        console.log("✅ SUCCESS: Extension loaded without errors or warnings!");
    } else {
        if (errors.length > 0) {
            console.log("❌ ERRORS FOUND:");
            errors.forEach((err, i) => {
                console.log(`  ${i + 1}. ${err}`);
            });
        }
        if (warnings.length > 0) {
            console.log("\n⚠️  WARNINGS FOUND:");
            warnings.forEach((warn, i) => {
                console.log(`  ${i + 1}. ${warn}`);
            });
        }
    }
    console.log("=".repeat(60) + "\n");

    if (errors.length > 0) {
        console.log("💡 TIP: Check chrome://extensions for more details");
        console.log("🖥️  Browser will stay open for 10 seconds for manual inspection...");
        await page.waitForTimeout(10000);
    } else {
        console.log("🖥️  Browser will stay open for 3 seconds...");
        await page.waitForTimeout(3000);
    }

    await context.close();
    console.log("✅ Browser closed");

    // Clean up temp profile
    if (fs.existsSync(tempProfile)) {
        fs.rmSync(tempProfile, { recursive: true, force: true });
    }

    process.exit(errors.length > 0 ? 1 : 0);
}

testExtensionLoad().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
});
