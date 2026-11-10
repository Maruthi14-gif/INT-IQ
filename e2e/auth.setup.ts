import fs from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { AUTH_DIR, STORAGE_STATE, TEST_RECRUITER_FILE, TEST_USER_FILE, originHeader, type TestUser } from "./helpers"

/**
 * Creates a throwaway account through the app's auth API (email + password,
 * which sends no email) and saves the signed-in browser state for the tests.
 * The account is deleted by auth.teardown.ts.
 */
setup("create a test account and sign in", async ({ page, baseURL }) => {
  async function createUser(role: "student" | "recruiter", name: string) {
    const user: Omit<TestUser, "id"> = {
      email: `intiq-e2e-${role}-${Date.now()}@example.com`,
      password: `E2e-${Math.random().toString(36).slice(2)}-Pw!`,
      name,
    }

    const intent = await page.request.post("/api/auth/role-intent", {
      data: { role },
      headers: originHeader(baseURL),
    })
    expect(intent.ok(), `role intent failed: ${intent.status()} ${await intent.text()}`).toBeTruthy()

    const res = await page.request.post("/api/auth/sign-up/email", {
      data: user,
      headers: originHeader(baseURL),
    })
    expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy()
    const body = await res.json()

    const completed = await page.request.post("/api/auth/complete", { headers: originHeader(baseURL) })
    expect(completed.ok(), `role assignment failed: ${completed.status()} ${await completed.text()}`).toBeTruthy()
    return { ...user, id: body.user.id }
  }

  const user = await createUser("student", "E2E Student")

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(TEST_USER_FILE, JSON.stringify(user, null, 2))

  // The new account lands on a working dashboard.
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible()
  await page.context().storageState({ path: STORAGE_STATE })

  const signedOut = await page.request.post("/api/auth/sign-out", { data: {}, headers: originHeader(baseURL) })
  expect(signedOut.ok(), `sign-out failed: ${signedOut.status()}`).toBeTruthy()
  const recruiter = await createUser("recruiter", "E2E Recruiter")
  fs.writeFileSync(TEST_RECRUITER_FILE, JSON.stringify(recruiter, null, 2))
})
