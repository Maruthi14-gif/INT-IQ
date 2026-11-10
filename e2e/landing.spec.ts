import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, watchForErrors } from "./helpers"

test.describe("Landing page", () => {
  test("renders every section without errors", async ({ page }) => {
    const problems = watchForErrors(page)
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1, name: /Interviews that follow up on what you actually said/ })).toBeVisible()
    for (const name of [/One interviewer for both sides of the table/, /Rehearse your next interview tonight/]) {
      await expect(page.getByRole("heading", { name })).toBeAttached()
    }
    // The section the product no longer has.
    await expect(page.getByRole("heading", { name: /From resume to report/ })).toHaveCount(0)
    // Candidate and recruiter columns, and the hero shows a real report preview.
    for (const text of ["For candidates", "For recruiters", "Follow-ups on what you said", "You make the call"]) {
      await expect(page.getByText(text, { exact: true }).first()).toBeAttached()
    }
    await expect(page.getByRole("complementary", { name: "Report preview" })).toBeAttached()
    // The study plan is not built, so the page must not promise it.
    await expect(page.getByText(/study plan/i)).toHaveCount(0)
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
    await header.getByRole("link", { name: "For candidates", exact: true }).click()
    await expect(page).toHaveURL(/#candidates$/)
    await expect(page.getByText("Voice interviews from your resume")).toBeInViewport()

    await header.getByRole("link", { name: "For recruiters", exact: true }).click()
    await expect(page).toHaveURL(/#recruiters$/)
    await expect(page.getByText("Post jobs, collect applicants")).toBeInViewport()
  })

  test("every call-to-action leads to sign-in", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: /Interviews that follow up/ })
    const finalCta = page.getByRole("region", { name: /Rehearse your next interview/ })

    for (const link of [
      page.getByRole("banner").getByRole("link", { name: "Start practicing" }),
      hero.getByRole("link", { name: "Start practicing" }),
      hero.getByRole("link", { name: "I’m hiring" }),
      finalCta.getByRole("link", { name: "Start practicing" }),
      finalCta.getByRole("link", { name: "I’m hiring" }),
    ]) {
      await page.goto("/")
      await link.click()
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeVisible()
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
