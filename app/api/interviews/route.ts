import { z } from "zod"
import { nextQuestion } from "@/lib/ai/interviewer"
import { aiError, apiUser, firstName, jsonError } from "@/lib/api"
import { INTERVIEW_MODES, INTERVIEW_TYPES } from "@/lib/db/schema"
import { createInterview } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { isVoiceConfigured } from "@/lib/vapi"

export const maxDuration = 60

const body = z.object({
  type: z.enum(INTERVIEW_TYPES),
  totalQuestions: z.number().int().min(3).max(10),
  mode: z.enum(INTERVIEW_MODES).default("text"),
})

/** Start an interview: create it and ask the first question. */
export async function POST(request: Request) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Pick a round and number of questions.")
  const { type, totalQuestions, mode } = parsed.data
  if (mode === "voice" && !isVoiceConfigured()) return jsonError(400, "Voice interviews aren't set up yet. Use text mode for now.")

  const profile = await getOrCreateProfile(user.id)
  const targetRole = profile.targetRole ?? "Software Developer"

  try {
    const question = await nextQuestion({
      type,
      targetRole,
      profile,
      firstName: firstName(user),
      turns: [],
      totalQuestions,
    })
    const interview = await createInterview(user.id, { type, mode, targetRole, totalQuestions, firstQuestion: question })
    return Response.json({ id: interview.id })
  } catch (error) {
    return aiError(error)
  }
}
