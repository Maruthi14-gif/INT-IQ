import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { test as teardown } from "@playwright/test"
import { AUTH_DIR, TEST_RECRUITER_FILE, TEST_USER_FILE, readRecruiterTestUser, readTestUser } from "./helpers"

/** Deletes the throwaway account with the Neon CLI (needs `neon login`). */
teardown("delete the test account", async () => {
  const users = [
    ...(fs.existsSync(TEST_USER_FILE) ? [readTestUser()] : []),
    ...(fs.existsSync(TEST_RECRUITER_FILE) ? [readRecruiterTestUser()] : []),
  ]
  if (!users.length) return
  for (const { id, email } of users) {
    try {
      execFileSync("neon", ["neon-auth", "user", "delete", id], { stdio: "pipe", shell: process.platform === "win32" })
      console.log(`Deleted test account ${email}`)
    } catch {
      console.warn(`Couldn't delete test account ${email}. Delete it with: neon neon-auth user delete ${id}`)
    }
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
})
