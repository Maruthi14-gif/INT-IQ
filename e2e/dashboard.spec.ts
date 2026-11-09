import { expect, test } from "@playwright/test"
import { STORAGE_STATE, expectNoHorizontalOverflow, readTestUser, signInWithPassword, watchForErrors } from "./helpers"

test.describe("Dashboard (signed in)", () => {
  test.use({ storageState: STORAGE_STATE })

  test("shows the welcome, role from the database, and all cards", async ({ page }) => {
    const problems = watchForErrors(page)
    await page.goto("/dashboard")

    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible()
    await expect(page.getByTestId("profile-role").filter({ visible: true })).toHaveText("student")
    await expect(page.getByRole("heading", { name: "Start a practice interview" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start interview" })).toBeDisabled()
    await expect(page.getByRole("heading", { name: "Get set up" })).toBeVisible()
    await expect(page.getByText("1 of 4")).toBeVisible()
    for (const stat of ["Interviews completed", "Average score", "Practice time"]) {
      await expect(page.getByText(stat)).toBeVisible()
    }
    await expect(page.getByText("No interviews yet")).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(problems).toEqual([])
  })

  test("session survives a reload, and /sign-in sends you back", async ({ page }) => {
    await page.goto("/dashboard")
    await page.reload()
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible()
    await page.goto("/sign-in")
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test("sidebar: active page, coming-soon items, collapse", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop sidebar; mobile has its own test")
    await page.goto("/dashboard")
    const sidebar = page.locator("[data-slot=sidebar]").first()

    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("data-active", "true")
    const soon = page.getByRole("button", { name: "Mock interview" })
    await expect(soon).toHaveAttribute("aria-disabled", "true")

    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    await page.locator("[data-sidebar=trigger]").click()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await page.keyboard.press("ControlOrMeta+b")
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
  })

  test("mobile: sidebar opens as a sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only")
    await page.goto("/dashboard")
    await page.locator("[data-sidebar=trigger]").click()
    const sheet = page.getByRole("dialog")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("link", { name: "Dashboard" })).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Mock interview" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
  })

  test("user menu shows the account; theme toggle works", async ({ page }) => {
    const user = readTestUser()
    await page.goto("/dashboard")
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.locator("[data-sidebar=trigger]").click()
    }
    await page.getByRole("button", { name: new RegExp(user.email.replace(/[.+]/g, "\\$&")) }).click()
    const menu = page.getByRole("menu")
    await expect(menu.getByText(user.email)).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /Profile/ })).toHaveAttribute("data-disabled", "")
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(menu).toBeHidden()
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      // Then close the mobile sidebar sheet (one Escape per layer).
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toBeHidden()
    }

    const html = page.locator("html")
    await page.getByRole("button", { name: "Toggle theme" }).click()
    await expect(html).not.toHaveClass(/dark/)
    await page.getByRole("button", { name: "Toggle theme" }).click()
    await expect(html).toHaveClass(/dark/)
  })
})

test.describe("Sign out", () => {
  // Uses its own session so signing out doesn't end the shared one.
  test("signs out and protects the dashboard again", async ({ page, baseURL, isMobile }) => {
    const user = readTestUser()
    await signInWithPassword(page.request, baseURL, user)
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible()

    if (isMobile) await page.locator("[data-sidebar=trigger]").click()
    await page.getByRole("button", { name: new RegExp(user.email.replace(/[.+]/g, "\\$&")) }).click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)

    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/sign-in$/)
  })
})
