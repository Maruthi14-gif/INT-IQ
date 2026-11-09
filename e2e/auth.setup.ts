import fs from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { AUTH_DIR, STORAGE_STATE, TEST_USER_FILE, originHeader, type TestUser } from "./helpers"

/**
 * Creates a throwaway account through the app's auth API (email + password,
 * which sends no email) and saves the signed-in browser state for the tests.
 * The account is deleted by auth.teardown.ts.
 */
setup("create a test account and sign in", async ({ page, baseURL }) => {
  const user: Omit<TestUser, "id"> = {
    email: `intiq-e2e-${Date.now()}@example.com`,
    password: `E2e-${Math.random().toString(36).slice(2)}-Pw!`,
    name: "E2E Student",
  }

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: user,
    headers: originHeader(baseURL),
  })
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(TEST_USER_FILE, JSON.stringify({ ...user, id: body.user.id }, null, 2))

  // The new account lands on a working dashboard.
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible()
  await page.context().storageState({ path: STORAGE_STATE })
})
