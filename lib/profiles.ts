import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { withRetry } from "@/lib/db/retry"
import { profiles, type Profile } from "@/lib/db/schema"

/**
 * Returns the user's profile, creating it (role "student") on first visit.
 * Only call with the id of the signed-in user from requireUser().
 * Both queries are idempotent, so a dropped connection is retried.
 */
export async function getOrCreateProfile(userId: string): Promise<Profile> {
  return withRetry(async () => {
    const [created] = await db.insert(profiles).values({ userId }).onConflictDoNothing().returning()
    if (created) return created

    const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
    return existing
  })
}
