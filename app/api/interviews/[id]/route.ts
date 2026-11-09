import { apiUser, jsonError } from "@/lib/api"
import { getInterview } from "@/lib/interviews"

/** Current progress of an interview (used by the voice room to follow the call). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params

  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")

  const answered = interview.turns.filter((t) => t.answer !== undefined).length
  return Response.json({
    status: interview.status,
    total: interview.totalQuestions,
    asked: interview.turns.length,
    answered,
    currentQuestion: interview.turns.at(-1)?.question ?? null,
  })
}
