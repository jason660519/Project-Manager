import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'npm run dev',
    port: 43187,
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:43187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
