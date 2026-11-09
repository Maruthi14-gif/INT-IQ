import "server-only"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { withRetry } from "@/lib/db/retry"
import { authUsers } from "@/lib/db/neon-auth"
import {
  interviews,
  type Interview,
  type InterviewMode,
  type InterviewReport,
  type InterviewTurn,
  type InterviewType,
} from "@/lib/db/schema"
import type { IntegritySession } from "@/lib/integrity"

/* Every function takes the signed-in user's id, so nobody can read another user's interviews. */

export async function createInterview(
  userId: string,
  data: { type: InterviewType; mode: InterviewMode; targetRole: string; totalQuestions: number; firstQuestion: string },
) {
  const [row] = await db
    .insert(interviews)
    .values({
      userId,
      type: data.type,
      mode: data.mode,
      targetRole: data.targetRole,
      totalQuestions: data.totalQuestions,
      turns: [{ question: data.firstQuestion }],
    })
    .returning()
  return row
}

export async function getInterview(userId: string, id: string): Promise<Interview | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await withRetry(() =>
    db
      .select()
      .from(interviews)
      .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
      .limit(1),
  )
  return row ?? null
}

/**
 * For the Vapi voice agent only: Vapi calls our endpoint without a user session, so the
 * caller must first verify the per-interview signed token (lib/vapi.ts). Returns the
 * interview plus the owner's name for the interviewer's greeting.
 */
export async function getInterviewForVoiceAgent(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await withRetry(() =>
    db
      .select({ interview: interviews, name: authUsers.name, email: authUsers.email })
      .from(interviews)
      .innerJoin(authUsers, eq(authUsers.id, interviews.userId))
      .where(eq(interviews.id, id))
      .limit(1),
  )
  return row ?? null
}

export async function saveTurns(userId: string, id: string, turns: InterviewTurn[]) {
  await db
    .update(interviews)
    .set({ turns })
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
}

/**
 * Saves `next` only if the stored turns are still `expected` (nobody changed them meanwhile).
 * The voice agent can get overlapping requests when the candidate keeps talking; the newer one wins.
 */
export async function saveTurnsIfUnchanged(userId: string, id: string, expected: InterviewTurn[], next: InterviewTurn[]) {
  const rows = await db
    .update(interviews)
    .set({ turns: next })
    .where(
      and(
        eq(interviews.id, id),
        eq(interviews.userId, userId),
        sql`${interviews.turns} = ${JSON.stringify(expected)}::jsonb`,
      ),
    )
    .returning({ id: interviews.id })
  return rows.length > 0
}

/** Stores one browser session's anti-cheat counts; other sessions of the interview are kept. */
export async function saveIntegritySession(userId: string, id: string, sessionId: string, session: IntegritySession) {
  await db
    .update(interviews)
    .set({
      integrity: sql`jsonb_set(coalesce(${interviews.integrity}, '{"sessions":{}}'::jsonb), ${`{sessions,${sessionId}}`}::text[], ${JSON.stringify(session)}::jsonb, true)`,
    })
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
}

export async function completeInterview(userId: string, id: string, turns: InterviewTurn[], report: InterviewReport) {
  await db
    .update(interviews)
    .set({ turns, report, overallScore: report.overallScore, status: "completed", completedAt: new Date() })
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
}

export async function listInterviews(userId: string, limit = 50) {
  return withRetry(() =>
    db
      .select({
        id: interviews.id,
        type: interviews.type,
        mode: interviews.mode,
        targetRole: interviews.targetRole,
        status: interviews.status,
        overallScore: interviews.overallScore,
        totalQuestions: interviews.totalQuestions,
        startedAt: interviews.startedAt,
        completedAt: interviews.completedAt,
      })
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.startedAt))
      .limit(limit),
  )
}

export type InterviewSummary = Awaited<ReturnType<typeof listInterviews>>[number]

export function practiceMinutes(list: InterviewSummary[]) {
  const ms = list
    .filter((i) => i.completedAt)
    .reduce((sum, i) => sum + (i.completedAt!.getTime() - i.startedAt.getTime()), 0)
  return Math.round(ms / 60_000)
}
