import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { test as teardown } from "@playwright/test"
import { AUTH_DIR, TEST_RECRUITER_FILE, TEST_USER_FILE, readCleanupList, readRecruiterTestUser, readTestUser } from "./helpers"

/** Deletes the throwaway accounts from the test branch with the Neon CLI (needs `neon login`). */
teardown("delete the test accounts", async () => {
  const branch = process.env.NEON_BRANCH
  const users = [
    ...(fs.existsSync(TEST_USER_FILE) ? [readTestUser()] : []),
    ...(fs.existsSync(TEST_RECRUITER_FILE) ? [readRecruiterTestUser()] : []),
    ...readCleanupList(),
  ]
  for (const { id, email } of users) {
    const args = ["neon-auth", "user", "delete", id, ...(branch ? ["--branch", branch] : [])]
    try {
      execFileSync("neon", args, { stdio: "pipe", shell: process.platform === "win32" })
      console.log(`Deleted test account ${email}`)
    } catch {
      console.warn(`Couldn't delete test account ${email}. Delete it with: neon ${args.join(" ")}`)
    }
  }
  // Keep the admin's saved session out of the way too; it's recreated on the next run.
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
})
