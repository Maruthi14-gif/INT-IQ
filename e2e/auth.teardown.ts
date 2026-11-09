import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { test as teardown } from "@playwright/test"
import { AUTH_DIR, TEST_USER_FILE, readTestUser } from "./helpers"

/** Deletes the throwaway account with the Neon CLI (needs `neon login`). */
teardown("delete the test account", async () => {
  if (!fs.existsSync(TEST_USER_FILE)) return
  const { id, email } = readTestUser()
  try {
    execFileSync("neon", ["neon-auth", "user", "delete", id], { stdio: "pipe", shell: process.platform === "win32" })
    console.log(`Deleted test account ${email}`)
  } catch {
    console.warn(`Couldn't delete test account ${email}. Delete it with: neon neon-auth user delete ${id}`)
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
})
