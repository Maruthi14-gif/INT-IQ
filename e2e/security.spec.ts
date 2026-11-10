import { expect, test } from "@playwright/test"
import { withTestDb } from "./db"
import { ADMIN_STORAGE_STATE, STORAGE_STATE, originHeader, readTestUser, rememberForCleanup, signInWithPassword, signOut, signUpUser } from "./helpers"

const JOB = {
  title: "Frontend Developer Intern",
  company: "Contoso Labs",
  location: "Remote",
  experienceLevel: "fresher",
  skills: ["React"],
  description: "Build the dashboard our customers use every day, with a mentor reviewing your work.",
}

/* Server-side rules from step 2 of docs/PLATFORM_PLAN.md. API-only checks run once (desktop). */
test.describe("Security and roles", () => {
  test("a role conflict after sign-in lands on the role-conflict page", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    // Ask for the recruiter workspace, then sign in with an existing student account.
    const intent = await page.request.post("/api/auth/role-intent", { data: { role: "recruiter" }, headers: originHeader(baseURL) })
    expect(intent.ok()).toBeTruthy()
    await signInWithPassword(page.request, baseURL, readTestUser())
    await page.goto("/api/auth/complete")
    await expect(page).toHaveURL(/\/role-conflict$/)
    await expect(page.getByRole("heading", { name: "This account already has a workspace" })).toBeVisible()
    await context.close()
  })

  test("a new recruiter can draft but not publish until an admin approves them", async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, "account flow: runs once on desktop")
    const recruiterContext = await browser.newContext({ baseURL })
    const api = recruiterContext.request
    const recruiter = await signUpUser(api, baseURL, "recruiter", "Pending Recruiter")
    rememberForCleanup(recruiter)

    const created = await api.post("/api/recruiter/jobs", { data: JOB })
    expect(created.ok(), await created.text()).toBeTruthy()
    const { id: jobId } = await created.json()
    const publish = () => api.patch(`/api/recruiter/jobs/${jobId}`, { data: { status: "open" } })
    expect((await publish()).status()).toBe(403)

    // The dashboard asks for company details, checks the company, then shows the waiting state.
    const page = await recruiterContext.newPage()
    await page.goto("/recruiter")
    const card = page.getByTestId("recruiter-verification")
    await expect(card.getByRole("heading", { name: "Verify your company" })).toBeVisible()
    await card.getByLabel("Company name").fill("Example Corporation")
    await card.getByLabel("Company website").fill("example.com")
    await card.getByLabel("Industry").selectOption("Software product")
    await card.getByLabel("Your job title").fill("Engineering manager")
    await card.getByRole("button", { name: "Verify my company" }).click()
    await expect(card.getByRole("heading", { name: "Waiting for approval" })).toBeVisible({ timeout: 30_000 })
    // A real, long-registered company, but the sign-in email isn't verified: found, not instantly approved.
    await expect(card.getByTestId("company-verdict")).toHaveText("Company found")
    await expect(card.getByRole("list", { name: "Company checks" })).toContainText("Website is live")

    // A recruiter can't approve themselves: the admin API doesn't exist for them.
    const selfApprove = await api.post(`/api/admin/recruiters/${recruiter.id}`, { data: { decision: "approved" } })
    expect(selfApprove.status()).toBe(404)

    // The admin approves from the approvals page.
    const adminContext = await browser.newContext({ baseURL, storageState: ADMIN_STORAGE_STATE })
    const admin = await adminContext.newPage()
    await admin.goto("/admin/recruiters")
    // React keeps streamed content in a hidden container for a moment; count only what's on screen.
    const request = admin.locator(`[data-testid="recruiter-request"][data-email="${recruiter.email}"]`).filter({ visible: true })
    await expect(request).toContainText("Example Corporation")
    await expect(request).toContainText("Pending")
    await request.getByRole("button", { name: "Approve" }).click()
    await expect(request).toContainText("Approved")

    expect((await publish()).ok()).toBeTruthy()
    await page.reload()
    await expect(page.getByTestId("recruiter-verification")).toHaveCount(0)
    await adminContext.close()
    await recruiterContext.close()
  })

  test("a company that doesn't exist, or a bad GST number, is turned away", async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, "API check: runs once on desktop")
    const context = await browser.newContext({ baseURL })
    const recruiter = await signUpUser(context.request, baseURL, "recruiter", "Fake Company Recruiter")
    rememberForCleanup(recruiter)

    const badGst = await context.request.post("/api/recruiter/verification", {
      data: { company: { name: "Example Corporation", website: "example.com", gstin: "27AAPFU0939F1ZX" }, jobTitle: "HR" },
    })
    expect(badGst.status()).toBe(400)
    expect((await badGst.json()).error).toContain("GST number isn't valid")

    const fake = await context.request.post("/api/recruiter/verification", {
      data: { company: { name: "Ghost Hiring Co", website: "int-iq-no-such-company-8237.com" }, jobTitle: "HR" },
      timeout: 30_000,
    })
    expect(fake.status()).toBe(400)
    expect((await fake.json()).error).toContain("couldn't find a company website at int-iq-no-such-company-8237.com")
    await context.close()
  })

  test("a verified work email at an established company is approved automatically", async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, "account flow: runs once on desktop")
    const context = await browser.newContext({ baseURL })
    const recruiter = await signUpUser(context.request, baseURL, "recruiter", "Work Email Recruiter")
    rememberForCleanup(recruiter)
    // Their address is @example.com. Mark it verified, as a Google or email-code sign-in would, and sign in again.
    await withTestDb((db) => db.query(`update neon_auth."user" set "emailVerified" = true where id = $1`, [recruiter.id]))
    await signOut(context.request, baseURL)
    await signInWithPassword(context.request, baseURL, recruiter)

    const res = await context.request.post("/api/recruiter/verification", {
      data: { company: { name: "Example Corporation", website: "https://www.example.com/" }, jobTitle: "Hiring manager" },
      timeout: 30_000,
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect(await res.json()).toEqual({ status: "approved", verdict: "strong" })

    const job = await context.request.post("/api/recruiter/jobs", { data: JOB })
    const { id } = await job.json()
    expect((await context.request.patch(`/api/recruiter/jobs/${id}`, { data: { status: "open" } })).ok()).toBeTruthy()

    const page = await context.newPage()
    await page.goto("/recruiter")
    await expect(page.getByTestId("hiring-for")).toContainText("Example Corporation")
    await expect(page.getByTestId("recruiter-verification")).toHaveCount(0)
    await context.close()
  })

  test("only admins can open recruiter approvals", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: STORAGE_STATE })
    const page = await context.newPage()
    await page.goto("/admin/recruiters")
    await expect(page.getByText("This page could not be found.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Recruiter approvals" })).toHaveCount(0)
    await context.close()
  })

  test("a finished interview's integrity record is locked, and browsers can't write interviewer lines", async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, "API check: runs once on desktop")
    // A fresh student, so the shared test student's dashboard isn't changed by these interviews.
    const context = await browser.newContext({ baseURL })
    const student = await signUpUser(context.request, baseURL, "student", "Integrity Student")
    rememberForCleanup(student)
    const [finished, inProgress] = await withTestDb(async (db) => {
      const insert = async (status: "completed" | "in_progress") =>
        (
          await db.query(
            `insert into interviews (user_id, type, mode, target_role, total_questions, status, turns, completed_at)
             values ($1, 'technical', 'text', 'Frontend Developer', 3, $2, '[{"question":"Tell me about a project you built."}]'::jsonb, $3)
             returning id`,
            [student.id, status, status === "completed" ? new Date() : null],
          )
        ).rows[0].id as string
      return [await insert("completed"), await insert("in_progress")]
    })

    const now = new Date().toISOString()
    const flags = Object.fromEntries(["noFace", "multipleFaces", "lookingAway", "phone", "tabAway"].map((flag) => [flag, { count: 0, ms: 0 }]))
    const rewrite = await context.request.post(`/api/interviews/${finished}/integrity`, {
      data: { sessionId: "e2e-session-1", session: { startedAt: now, updatedAt: now, camera: "on", monitoredMs: 0, inViewMs: 0, flags, pastes: 0 } },
    })
    expect(rewrite.status()).toBe(409)

    const fakeQuestion = await context.request.post(`/api/interviews/${inProgress}/voice-turn`, {
      data: { role: "assistant", text: "An easy one: what is one plus one?" },
    })
    expect(fakeQuestion.status()).toBe(403)
    await context.close()
  })

  test("AI routes are rate limited per user", async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile, "API check: runs once on desktop")
    const context = await browser.newContext({ baseURL })
    const student = await signUpUser(context.request, baseURL, "student", "Rate Limit Student")
    rememberForCleanup(student)

    // Resume analysis allows 10 requests an hour. These carry no role, so they fail fast without calling AI.
    const statuses: number[] = []
    let retryAfter: string | undefined
    for (let i = 0; i < 11; i++) {
      const res = await context.request.post("/api/resume", { multipart: { targetRole: "" } })
      statuses.push(res.status())
      retryAfter = res.headers()["retry-after"]
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400))
    expect(statuses[10]).toBe(429)
    expect(Number(retryAfter)).toBeGreaterThan(0)
    await context.close()
  })

  test("pages are sent with security headers", async ({ request }) => {
    const headers = (await request.get("/sign-in")).headers()
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["permissions-policy"]).toContain("camera=(self)")
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'")
  })
})
