import fs from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { withTestDb } from "./db"
import {
  ADMIN_STORAGE_STATE,
  AUTH_DIR,
  STORAGE_STATE,
  TEST_RECRUITER_FILE,
  TEST_USER_FILE,
  originHeader,
  signInWithPassword,
  signOut,
  signUpUser,
  testAdmin,
} from "./helpers"

/**
 * Creates the throwaway student and recruiter (email + password on the test branch, which
 * sends no email), signs in the test admin, and approves the recruiter through the admin API.
 * Student and recruiter are deleted by auth.teardown.ts; the admin stays on the test branch.
 */
setup("create test accounts and sign in", async ({ page, baseURL }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const student = await signUpUser(page.request, baseURL, "student", "E2E Student")
  fs.writeFileSync(TEST_USER_FILE, JSON.stringify(student, null, 2))
  // The new account lands on a working dashboard.
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: /E2E.s interview prep/ })).toBeVisible()
  await page.context().storageState({ path: STORAGE_STATE })
  await signOut(page.request, baseURL)

  // A new recruiter starts pending and sends company details for review.
  const recruiter = await signUpUser(page.request, baseURL, "recruiter", "E2E Recruiter")
  fs.writeFileSync(TEST_RECRUITER_FILE, JSON.stringify(recruiter, null, 2))
  const details = await page.request.post("/api/recruiter/verification", {
    // example.com is a real, long-registered domain; the test email isn't verified, so this waits for the admin.
    data: { company: { name: "Example Corporation", website: "example.com" }, jobTitle: "Campus recruiter" },
    headers: originHeader(baseURL),
  })
  expect(details.ok(), `verification request failed: ${details.status()} ${await details.text()}`).toBeTruthy()
  await signOut(page.request, baseURL)

  // The admin: created once, then reused. Its email must count as verified to be an admin.
  const admin = testAdmin()
  const signIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email: admin.email, password: admin.password },
    headers: originHeader(baseURL),
  })
  if (!signIn.ok()) {
    const intent = await page.request.post("/api/auth/role-intent", { data: { role: "student" }, headers: originHeader(baseURL) })
    expect(intent.ok()).toBeTruthy()
    const created = await page.request.post("/api/auth/sign-up/email", { data: admin, headers: originHeader(baseURL) })
    expect(created.ok(), `admin sign-up failed: ${created.status()} ${await created.text()}`).toBeTruthy()
    await page.request.post("/api/auth/complete", { headers: originHeader(baseURL) })
  }
  await withTestDb((db) => db.query(`update neon_auth."user" set "emailVerified" = true where email = $1`, [admin.email]))
  // Sign in again so the session carries the verified flag.
  await signOut(page.request, baseURL)
  await signInWithPassword(page.request, baseURL, { ...admin, id: "" })
  await page.context().storageState({ path: ADMIN_STORAGE_STATE })

  const approved = await page.request.post(`/api/admin/recruiters/${recruiter.id}`, {
    data: { decision: "approved" },
    headers: originHeader(baseURL),
  })
  expect(approved.ok(), `recruiter approval failed: ${approved.status()} ${await approved.text()}`).toBeTruthy()
})
