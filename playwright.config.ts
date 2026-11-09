import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests.
 *   npm run test:e2e                                         → local production build (npm run start)
 *   E2E_BASE_URL=https://int-iq.vercel.app npm run test:e2e  → a deployed site
 *
 * Tests use the Edge browser installed on the machine (no browser download).
 * A throwaway user is created through the auth API and deleted afterwards
 * with the Neon CLI (`neon login` required). No emails are sent.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL)

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // Over the internet, allow one retry for network blips; Playwright reports those as "flaky".
  retries: isLocal ? 0 : 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]],
  use: {
    baseURL,
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /auth\.teardown\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 900 } },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "msedge" },
      dependencies: ["setup"],
    },
  ],
  webServer: isLocal
    ? { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
})
