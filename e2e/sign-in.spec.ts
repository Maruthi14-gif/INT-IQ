import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, watchForErrors, lightTheLamp } from "./helpers"

const SEND_CODE = "**/api/auth/email-otp/send-verification-otp"

test.describe("Sign-in (signed out)", () => {
  test("protected pages send you to sign-in", async ({ page }) => {
    await page.goto("/dashboard")
    await lightTheLamp(page)
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test("rejects an invalid email without calling the server", async ({ page }) => {
    let codeRequests = 0
    await page.route(SEND_CODE, (route) => {
      codeRequests++
      return route.abort()
    })
    await page.goto("/sign-in")
    await lightTheLamp(page)
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled()
    await page.getByRole("radio", { name: /Candidate/ }).click()
    await page.getByLabel("Email address").fill("not-an-email")
    await page.getByRole("button", { name: "Continue with email" }).click()
    // (Next.js also renders an empty role="alert" route announcer, so match by text.)
    await expect(page.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toBeVisible()
    expect(codeRequests).toBe(0)
  })

  test("valid email moves to the code step (email sending stubbed)", async ({ page }) => {
    // Stub the email send so no real email goes out; everything else is real.
    let sentTo = ""
    await page.route(SEND_CODE, async (route) => {
      sentTo = route.request().postDataJSON().email
      await route.fulfill({ json: { success: true } })
    })
    const problems = watchForErrors(page)

    await page.goto("/sign-in")
    await lightTheLamp(page)
    await page.getByRole("radio", { name: /Candidate/ }).click()
    await page.getByLabel("Email address").fill("  Student.Test@Example.COM ")
    await page.getByRole("button", { name: "Continue with email" }).click()

    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    expect(sentTo).toBe("student.test@example.com") // trimmed + lowercased
    await expect(page.getByText("student.test@example.com")).toBeVisible()
    await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled()

    // Code box: digits only
    const code = page.getByRole("textbox", { name: "6-digit code" })
    await code.pressSequentially("12ab3")
    await expect(code).toHaveValue("123")
    await expect(page.getByRole("button", { name: "Verify and continue" })).toBeDisabled()

    // Wrong code → real Neon Auth answer → friendly error, box cleared
    await code.fill("")
    await code.pressSequentially("000000")
    await expect(page.getByRole("alert").filter({ hasText: "That code isn't right" })).toBeVisible()
    await expect(code).toHaveValue("")
    await expect(page.getByRole("button", { name: "Verify and continue" })).toBeDisabled() // spinner gone, no code

    // Back to the email step, email kept
    await page.getByRole("button", { name: "Use a different email" }).click()
    await expect(page.getByLabel("Email address")).toHaveValue("student.test@example.com")
    await expectNoHorizontalOverflow(page)
    expect(problems.filter((p) => !p.includes("400"))).toEqual([])
  })

  test("Continue with Google starts Google's sign-in", async ({ page }) => {
    await page.goto("/sign-in")
    await lightTheLamp(page)
    await page.getByRole("radio", { name: /Recruiter/ }).click()
    const authorizationRequest = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.hostname === "accounts.google.com" && url.pathname.includes("/o/oauth2/")
    })
    await page.getByRole("button", { name: "Continue with Google" }).click()
    const request = await authorizationRequest
    expect(new URL(request.url()).hostname).toBe("accounts.google.com")
    await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 })
    expect(new URL(page.url()).hostname).toBe("accounts.google.com")
  })
})
