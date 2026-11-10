import fs from "node:fs"
import path from "node:path"
import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const AUTH_DIR = path.join(__dirname, ".auth")
export const STORAGE_STATE = path.join(AUTH_DIR, "user.json")
export const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json")
export const TEST_USER_FILE = path.join(AUTH_DIR, "test-user.json")
export const TEST_RECRUITER_FILE = path.join(AUTH_DIR, "test-recruiter.json")
/** Extra throwaway users created by individual tests; auth.teardown.ts deletes them too. */
export const CLEANUP_FILE = path.join(AUTH_DIR, "cleanup.json")

export type TestUser = { id: string; email: string; password: string; name: string }

export function readTestUser(): TestUser {
  return JSON.parse(fs.readFileSync(TEST_USER_FILE, "utf8"))
}

export function readRecruiterTestUser(): TestUser {
  return JSON.parse(fs.readFileSync(TEST_RECRUITER_FILE, "utf8"))
}

/** The test admin: its email is in ADMIN_EMAILS of .env.test.local. It stays on the test branch between runs. */
export function testAdmin(): Omit<TestUser, "id"> {
  const email = (process.env.ADMIN_EMAILS ?? "").split(/[\s,;]+/).filter(Boolean)[0]
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) throw new Error("Set ADMIN_EMAILS and E2E_ADMIN_PASSWORD in .env.test.local")
  return { email, password, name: "E2E Admin" }
}

export function rememberForCleanup(user: TestUser) {
  const list: TestUser[] = fs.existsSync(CLEANUP_FILE) ? JSON.parse(fs.readFileSync(CLEANUP_FILE, "utf8")) : []
  list.push(user)
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(CLEANUP_FILE, JSON.stringify(list, null, 2))
}

export function readCleanupList(): TestUser[] {
  return fs.existsSync(CLEANUP_FILE) ? JSON.parse(fs.readFileSync(CLEANUP_FILE, "utf8")) : []
}

/**
 * Creates a throwaway account with the given role, through the same steps as the sign-in page
 * (role intent, then sign-up, then completion). Email + password works only on the test branch.
 * The request context ends up signed in as the new user.
 */
export async function signUpUser(request: APIRequestContext, baseURL: string | undefined, role: "student" | "recruiter", name: string) {
  const user: Omit<TestUser, "id"> = {
    email: `intiq-e2e-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
    password: `E2e-${Math.random().toString(36).slice(2)}-Pw!`,
    name,
  }
  const intent = await request.post("/api/auth/role-intent", { data: { role }, headers: originHeader(baseURL) })
  expect(intent.ok(), `role intent failed: ${intent.status()} ${await intent.text()}`).toBeTruthy()
  const res = await request.post("/api/auth/sign-up/email", { data: user, headers: originHeader(baseURL) })
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  const completed = await request.post("/api/auth/complete", { headers: originHeader(baseURL) })
  expect(completed.ok(), `role assignment failed: ${completed.status()} ${await completed.text()}`).toBeTruthy()
  return { ...user, id: body.user.id as string }
}

export async function signOut(request: APIRequestContext, baseURL: string | undefined) {
  const res = await request.post("/api/auth/sign-out", { data: {}, headers: originHeader(baseURL) })
  expect(res.ok(), `sign-out failed: ${res.status()}`).toBeTruthy()
}

/** Auth API calls need an Origin header that Neon Auth trusts (the app's own origin). */
export function originHeader(baseURL: string | undefined) {
  return { origin: new URL(baseURL ?? "http://localhost:3000").origin }
}

/** Signs in through the app's auth proxy; cookies land in the request's browser context. */
export async function signInWithPassword(request: APIRequestContext, baseURL: string | undefined, user: TestUser) {
  const res = await request.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
    headers: originHeader(baseURL),
  })
  expect(res.ok(), `sign-in failed: ${res.status()} ${await res.text()}`).toBeTruthy()
}

/** The page should never scroll sideways. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1)
}

// Connection-level failures come from the network (Wi-Fi, ISP), not the app.
const NETWORK_NOISE = /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|NETWORK_CHANGED|INTERNET_DISCONNECTED|HTTP2_PING_FAILED|TIMED_OUT)/

/** Collects console errors and failed same-origin requests while a test runs. */
export function watchForErrors(page: Page) {
  const problems: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error" && !NETWORK_NOISE.test(msg.text())) problems.push(`console: ${msg.text()}`)
  })
  page.on("pageerror", (err) => problems.push(`page error: ${err.message}`))
  page.on("response", (res) => {
    const url = new URL(res.url())
    if (url.origin === new URL(page.url() || res.url()).origin && res.status() >= 500) {
      problems.push(`HTTP ${res.status()} ${url.pathname}`)
    }
  })
  return problems
}

/** The sign-in form sits in a dark room until the desk lamp is switched on: pull the cord (keyboard). */
export async function lightTheLamp(page: Page) {
  const cord = page.getByRole("button", { name: /Pull the lamp cord/ })
  if ((await cord.getAttribute("aria-pressed")) !== "true") await cord.press("Enter")
  await expect(page.getByTestId("lamp-card")).not.toHaveAttribute("inert", "")
}
