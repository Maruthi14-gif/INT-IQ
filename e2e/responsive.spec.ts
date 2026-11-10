import { expect, test } from "@playwright/test"
import { STORAGE_STATE, expectNoHorizontalOverflow } from "./helpers"

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1920, height: 1080 },
]

const PAGES = [
  { path: "/", heading: /Interviews that follow up/, auth: false },
  { path: "/sign-in", heading: /Choose your workspace/, auth: false },
  { path: "/dashboard", heading: /E2E.s interview prep/, auth: true },
]

// Layout checks run once (desktop project); the viewport is set per test.
test.describe("Responsive layout", () => {
  test.skip(({ isMobile }) => isMobile, "runs in the desktop project with explicit viewports")

  for (const vp of VIEWPORTS) {
    for (const pg of PAGES) {
      test(`${pg.path} at ${vp.name} ${vp.width}px`, async ({ browser, baseURL }, testInfo) => {
        const context = await browser.newContext({
          baseURL,
          viewport: { width: vp.width, height: vp.height },
          storageState: pg.auth ? STORAGE_STATE : undefined,
        })
        const page = await context.newPage()
        await page.goto(pg.path)
        await expect(page.getByRole("heading", { name: pg.heading }).first()).toBeVisible()
        await expectNoHorizontalOverflow(page)

        // Nothing important hidden off-screen: the main heading sits inside the viewport width.
        const box = await page.getByRole("heading", { name: pg.heading }).first().boundingBox()
        expect(box && box.x >= 0 && box.x + box.width <= vp.width + 1).toBeTruthy()

        await testInfo.attach(`${pg.path} ${vp.name}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        })
        await context.close()
      })
    }
  }
})
