import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, watchForErrors } from "./helpers"

test.describe("Landing page", () => {
  test("renders every section without errors", async ({ page }) => {
    const problems = watchForErrors(page)
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1, name: /Walk into every interview/ })).toBeVisible()
    for (const name of [/Everything you need to practice/, /From resume to report/, /Your next interview is/]) {
      await expect(page.getByRole("heading", { name })).toBeAttached()
    }
    // Feature cards and steps
    for (const title of ["Live voice interviews", "Built from your resume", "Feedback on every answer", "Get your report"]) {
      await expect(page.getByRole("heading", { name: title })).toBeAttached()
    }
    // No broken images
    const broken = await page.locator("img").evaluateAll((imgs) =>
      imgs.filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0).length,
    )
    expect(broken).toBe(0)
    await expectNoHorizontalOverflow(page)
    expect(problems).toEqual([])
  })

  test("header nav links scroll to their sections", async ({ page, isMobile }) => {
    test.skip(isMobile, "section links are hidden on small screens")
    await page.goto("/")
    const header = page.getByRole("banner")
    await header.getByRole("link", { name: "Features", exact: true }).click()
    await expect(page).toHaveURL(/#features$/)
    await expect(page.getByRole("region", { name: /Everything you need/ })).toBeInViewport()

    await header.getByRole("link", { name: "How it works", exact: true }).click()
    await expect(page).toHaveURL(/#how-it-works$/)
    await expect(page.getByRole("region", { name: /From resume to report/ })).toBeInViewport()
  })

  test("every call-to-action leads to sign-in", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: /Walk into every interview/ })
    const finalCta = page.getByRole("region", { name: /Your next interview is/ })

    await hero.getByRole("link", { name: "See how it works" }).click()
    await expect(page).toHaveURL(/#how-it-works$/)

    for (const link of [
      page.getByRole("banner").getByRole("link", { name: "Start practicing" }),
      hero.getByRole("link", { name: "Start practicing free" }),
      finalCta.getByRole("link", { name: "Start practicing free" }),
    ]) {
      await page.goto("/")
      await link.click()
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole("heading", { name: "Welcome to INT-IQ" })).toBeVisible()
    }
  })

  test("logo links home and theme toggle switches and persists", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByRole("link", { name: "INT-IQ home" }).click()
    await expect(page).toHaveURL(/\/$/)

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
