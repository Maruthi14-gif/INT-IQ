import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { withRetry } from "@/lib/db/retry"
import { profiles, type ExperienceLevel, type Profile, type ResumeInsights, type UserRole } from "@/lib/db/schema"

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

/** Assigns the first selected workspace once; a later request cannot change it. */
export async function chooseInitialRole(userId: string, role: UserRole): Promise<Profile> {
  const [updated] = await withRetry(() =>
    db
      .update(profiles)
      .set({ role, roleChosen: true })
      .where(and(eq(profiles.userId, userId), eq(profiles.roleChosen, false)))
      .returning(),
  )
  return updated ?? getOrCreateProfile(userId)
}

export async function saveResume(
  userId: string,
  data: {
    targetRole: string
    experienceLevel: ExperienceLevel
    jobDescription: string | null
    resumeFileName: string | null
    resumeText: string | null
    resumeInsights: ResumeInsights | null
  },
): Promise<Profile> {
  await getOrCreateProfile(userId)
  const [updated] = await withRetry(() =>
    db
      .update(profiles)
      .set({ ...data, resumeUpdatedAt: data.resumeText ? new Date() : undefined })
      .where(eq(profiles.userId, userId))
      .returning(),
  )
  return updated
}
