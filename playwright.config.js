import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Dev server must be started separately: npm run dev
  webServer: {
    command: 'npm run dev -- --port 4322',
    port: 4322,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
