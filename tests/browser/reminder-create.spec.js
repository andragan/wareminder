const { chromium } = require('playwright');
const { test, expect } = require('@playwright/test');
const path = require('path');
const { popupUrl } = require("./helpers/paths");

test.describe('Reminder Creation', () => {
    let context;
    let page;

    test.beforeAll(async () => {
        // use a dedicated directory for user data to ensure a clean state
        const userDataDir = path.join(__dirname, 'test-user-data');
        context = await chromium.launchPersistentContext(userDataDir, {
            headless: false, // set to true to run tests without opening a browser window
        });

        page = await context.newPage();
    });

    test('should create a new reminder from popup', async ({ page }) => {
        // load whatsapp web to initialize the extension's background page and popup
        await page.goto('https://web.whatsapp.com/');

        /*
        // navigate to a chat page where the button for the extension is visible
        await page.goto('https://web.whatsapp.com/chat/1234567890');

        // click the extension's icon 
        await page.click('#wareminder-extension-icon');

        // load the popup
        await page.goto(popupUrl);
        
        // Assert: reminder appears in list
        await expect(page.locator('.reminder-list')).toContainText('Test reminder');
        */        
    });
});
