import { buildReport } from "@/lib/ai/interviewer"
import { z } from "zod"
import { aiError, apiUser, jsonError } from "@/lib/api"
import { completeInterview, getInterview } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"

export const maxDuration = 60

const coachingSchema = z.object({
  camera: z
    .object({
      calibrated: z.boolean(),
      analyzedSeconds: z.number().int().min(0).max(86_400),
      visiblePercent: z.number().int().min(0).max(100),
      issues: z
        .array(
          z.object({
            code: z.string().max(50),
            label: z.string().max(100),
            seconds: z.number().int().min(0).max(86_400),
            reminders: z.number().int().min(0).max(20),
          }),
        )
        .max(20),
    })
    .optional(),
  delivery: z
    .object({
      words: z.number().int().min(0).max(100_000),
      wordsPerMinute: z.number().int().min(0).max(1_000).nullable(),
      fillerWords: z.number().int().min(0).max(10_000),
      longPauses: z.number().int().min(0).max(10_000),
    })
    .optional(),
})

/** End early: grade the questions answered so far. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params

  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.status === "completed") return Response.json({ done: true })

  const answered = interview.turns.filter((t) => t.answer !== undefined)
  if (answered.length === 0) return jsonError(400, "Answer at least one question to get a report.")

  try {
    const body = await request.json().catch(() => null)
    const coaching = coachingSchema.safeParse(body?.coaching)
    const profile = await getOrCreateProfile(user.id)
    const report = await buildReport({ type: interview.type, targetRole: interview.targetRole, profile, turns: answered })
    if (coaching.success) report.coaching = coaching.data
    await completeInterview(user.id, id, answered, report)
    return Response.json({ done: true })
  } catch (error) {
    return aiError(error)
  }
}
