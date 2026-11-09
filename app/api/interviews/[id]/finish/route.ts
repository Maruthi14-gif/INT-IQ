import { buildReport } from "@/lib/ai/interviewer"
import { aiError, apiUser, jsonError } from "@/lib/api"
import { completeInterview, getInterview } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"

export const maxDuration = 60

/** End early: grade the questions answered so far. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params

  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.status === "completed") return Response.json({ done: true })

  const answered = interview.turns.filter((t) => t.answer !== undefined)
  if (answered.length === 0) return jsonError(400, "Answer at least one question to get a report.")

  try {
    const profile = await getOrCreateProfile(user.id)
    const report = await buildReport({ type: interview.type, targetRole: interview.targetRole, profile, turns: answered })
    await completeInterview(user.id, id, answered, report)
    return Response.json({ done: true })
  } catch (error) {
    return aiError(error)
  }
}
