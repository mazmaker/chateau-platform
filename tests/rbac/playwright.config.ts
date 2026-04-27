import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for RBAC tests
 *
 * Base URL should match your dev server (default: http://localhost:5175)
 */
export default defineConfig({
  testDir: './tests/rbac',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report/rbac' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
