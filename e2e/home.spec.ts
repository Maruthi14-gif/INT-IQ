import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, watchForErrors } from "./helpers"

/* There is no marketing home page: the site opens straight on sign-in. */
test.describe("Home", () => {
  test("opening the site goes straight to sign-in", async ({ page }) => {
    const problems = watchForErrors(page)
    await page.goto("/")
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(problems).toEqual([])
  })

  test("sign-in is just the form, with no app description", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeVisible()
    // The old info panel and landing copy are gone.
    for (const text of [/Practice the interview before it counts/, /One interviewer for both sides/, /How it works/, /study plan/i]) {
      await expect(page.getByText(text)).toHaveCount(0)
    }
    await expect(page.getByRole("link", { name: "INT-IQ home" })).toHaveCount(0)
  })

  test("theme toggle switches and persists", async ({ page }) => {
    await page.goto("/sign-in")
    const html = page.locator("html")
    await expect(html).toHaveClass(/dark/)
    await page.getByRole("button", { name: "Toggle theme" }).click()
    await expect(html).not.toHaveClass(/dark/)
    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
    await page.getByRole("button", { name: "Toggle theme" }).click()
    await expect(html).toHaveClass(/dark/)
  })
})
