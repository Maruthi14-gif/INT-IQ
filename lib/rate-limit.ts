import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { rateLimits } from "@/lib/db/schema"

/**
 * Per-user limits on routes that call Gemini or Vapi, so one account can't drain the
 * shared quota. Generous for real use: a full interview needs about 12 requests.
 */
const LIMITS = {
  "interview-start": { limit: 20, windowSeconds: 60 * 60 },
  "interview-answer": { limit: 150, windowSeconds: 60 * 60 },
  "interview-finish": { limit: 30, windowSeconds: 60 * 60 },
  resume: { limit: 10, windowSeconds: 60 * 60 },
  "voice-call": { limit: 20, windowSeconds: 60 * 60 },
  "voice-agent": { limit: 300, windowSeconds: 60 * 60 },
  copilot: { limit: 60, windowSeconds: 60 * 60 },
  "recruiter-verification": { limit: 5, windowSeconds: 60 * 60 },
} as const

export type RateLimitBucket = keyof typeof LIMITS

function wait(seconds: number) {
  return seconds < 120 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`
}

/**
 * Counts one request for `subject` (a user or interview id). Returns a 429 response when the
 * limit is used up, otherwise null. If the counter itself fails, the request is let through.
 */
export async function rateLimited(bucket: RateLimitBucket, subject: string): Promise<Response | null> {
  const { limit, windowSeconds } = LIMITS[bucket]
  const key = `${bucket}:${subject}`
  try {
    const result = await db.execute(sql`
      insert into ${rateLimits} ("key", "window_start", "count") values (${key}, now(), 1)
      on conflict ("key") do update set
        "count" = case when ${rateLimits.windowStart} <= now() - make_interval(secs => ${windowSeconds}::int)
          then 1 else ${rateLimits.count} + 1 end,
        "window_start" = case when ${rateLimits.windowStart} <= now() - make_interval(secs => ${windowSeconds}::int)
          then now() else ${rateLimits.windowStart} end
      returning "count",
        ceil(extract(epoch from ("window_start" + make_interval(secs => ${windowSeconds}::int) - now())))::int as "resetIn"`)
    const row = result.rows[0] as { count: number | string; resetIn: number | string } | undefined
    if (!row || Number(row.count) <= limit) return null
    const retryAfter = Math.max(1, Number(row.resetIn) || windowSeconds)
    return Response.json(
      { error: `You're going a little fast. Try again in ${wait(retryAfter)}.` },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    )
  } catch (error) {
    console.error("[rate-limit] counter failed, allowing the request", error)
    return null
  }
}
