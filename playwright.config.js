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
  webServer: {
    command: 'node scripts/test-server.js',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
});
