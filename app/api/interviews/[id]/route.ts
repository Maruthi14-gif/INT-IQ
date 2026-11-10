import { apiUserWithRole, jsonError } from "@/lib/api"
import { getInterview } from "@/lib/interviews"

/** Current progress of an interview (used by the voice room to follow the call). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error
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
