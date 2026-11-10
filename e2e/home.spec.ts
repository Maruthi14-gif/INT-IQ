import { expect, test } from "@playwright/test"
import { expectNoHorizontalOverflow, lightTheLamp, watchForErrors } from "./helpers"

/* The site opens straight on sign-in, in a dark room with a desk lamp. */
test.describe("Home and the lamp room", () => {
  test("opening the site goes straight to sign-in", async ({ page }) => {
    const problems = watchForErrors(page)
    await page.goto("/")
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole("button", { name: "Pull the lamp cord to sign in" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(problems).toEqual([])
  })

  test("the form stays out of reach until the lamp is on", async ({ page }) => {
    await page.goto("/sign-in")
    const card = page.getByTestId("lamp-card")
    await expect(card).toHaveAttribute("inert", "")
    await expect(page.getByText("Pull the cord to sign in")).toBeVisible()

    await lightTheLamp(page)
    await expect(page.getByRole("heading", { name: "Choose your workspace" })).toBeInViewport()
    await page.getByRole("radio", { name: /Candidate/ }).click()
    await expect(page.getByRole("radio", { name: /Candidate/ })).toHaveAttribute("aria-checked", "true")
  })

  test("pulling the cord again switches the light off", async ({ page }) => {
    await page.goto("/sign-in")
    await lightTheLamp(page)
    await page.getByRole("button", { name: /Pull the lamp cord to switch the light off/ }).press("Enter")
    await expect(page.getByTestId("lamp-card")).toHaveAttribute("inert", "")
  })

  test("a lit lamp is remembered on this device", async ({ page }) => {
    await page.goto("/sign-in")
    await lightTheLamp(page)
    await page.reload()
    await expect(page.getByTestId("lamp-card")).not.toHaveAttribute("inert", "")
  })

  test("dragging the cord down switches the lamp on", async ({ page, isMobile }) => {
    test.skip(isMobile, "mouse drag")
    await page.goto("/sign-in")
    const cord = page.getByRole("button", { name: "Pull the lamp cord to sign in" })
    const box = (await cord.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId("lamp-card")).not.toHaveAttribute("inert", "")
  })

  test("no app description on the way in", async ({ page }) => {
    await page.goto("/sign-in")
    for (const text of [/Practice the interview before it counts/, /One interviewer for both sides/, /How it works/, /study plan/i]) {
      await expect(page.getByText(text)).toHaveCount(0)
    }
  })
})
