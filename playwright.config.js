const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30 * 1000,
  use: {
    baseURL: 'https://web.whatsapp.com',
    trace: 'on-first-retry',
  },
});
