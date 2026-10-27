import { defineConfig, devices } from "@playwright/test";

/**
 * Golden-path e2e for the OneRecord prototype.
 * Run after `npm run build`: `npx playwright test e2e/golden.spec.ts --reporter=line`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "test-results/e2e",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Singapore",
    locale: "en-SG",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
