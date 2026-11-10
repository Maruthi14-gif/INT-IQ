import fs from "node:fs"
import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests.
 *   npm run test:e2e                                  → starts the production build (`npm run build` first)
 *                                                       on port 3100 against the Neon test branch
 *   E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e → a deployment that uses the test branch
 *
 * Local runs read .env.test.local: a separate Neon branch ("e2e-tests") with its own auth,
 * so tests never create accounts or data on the live "production" branch. Throwaway users
 * are deleted afterwards with the Neon CLI (`neon login` required). No emails are sent.
 * Tests use the Edge browser installed on the machine (no browser download).
 */
const TEST_ENV_FILE = ".env.test.local"

function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match) continue
    let value = match[2]
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) value = value.slice(1, -1)
    env[match[1]] = value
  }
  return env
}

const remote = process.env.E2E_BASE_URL
const isLocal = !remote
const baseURL = remote ?? "http://localhost:3100"

if (isLocal) {
  const testEnv = readEnvFile(TEST_ENV_FILE)
  if (!testEnv.DATABASE_URL || !testEnv.NEON_AUTH_BASE_URL || !testEnv.NEON_BRANCH) {
    throw new Error(`Missing ${TEST_ENV_FILE} (NEON_BRANCH, DATABASE_URL, NEON_AUTH_BASE_URL...). Tests never run against the live database.`)
  }
  if (testEnv.NEON_BRANCH === "production") throw new Error(`${TEST_ENV_FILE} points at the production branch. Use the e2e-tests branch.`)
  // The server and the test runner (setup, teardown, seeding helpers) use the same branch.
  Object.assign(process.env, testEnv)
}

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
  // Its own server on its own port, so a running `npm run dev` (live data) is never reused.
  webServer: isLocal
    ? { command: "npm run start -- -p 3100", url: baseURL, reuseExistingServer: false, timeout: 120_000, env: { PORT: "3100" } }
    : undefined,
})
