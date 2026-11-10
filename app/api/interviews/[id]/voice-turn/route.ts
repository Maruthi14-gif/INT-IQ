import { z } from "zod"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { getInterview, saveTurns } from "@/lib/interviews"
import { CLOSING_LINE, isLocalVoiceFallback } from "@/lib/vapi"
import { isVisualCoachingMessage } from "@/lib/visual-coaching"

const bodySchema = z.object({
  role: z.enum(["assistant", "user"]),
  text: z.string().trim().min(1).max(8_000),
})

/**
 * Localhost voice fallback: Vapi handles the real-time conversation with the saved
 * assistant while the browser mirrors final transcript turns into the interview row.
 * This endpoint is session-authenticated and never receives camera frames or audio.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error
  // Otherwise a candidate could write the interviewer's questions into their own interview.
  if (!isLocalVoiceFallback(request.url)) return jsonError(403, "Transcript turns are saved by the voice service, not the browser.")
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Invalid voice transcript turn.")
  const { id } = await params
  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.mode !== "voice") return jsonError(403, "This interview isn't a voice interview.")
  if (interview.status === "completed") return Response.json({ done: true })

  const { role, text } = parsed.data
  const turns = [...interview.turns]
  const current = turns.at(-1)
  if (!current) return jsonError(409, "This interview has no active question.")

  if (role === "user") {
    const existing = current.answer?.trim() ?? ""
    if (!existing || !normalize(existing).endsWith(normalize(text))) {
      turns[turns.length - 1] = {
        ...current,
        answer: existing ? `${existing} ${text}` : text,
        answeredAt: new Date().toISOString(),
      }
      await saveTurns(user.id, id, turns)
    }
  } else if (
    current.answer !== undefined &&
    turns.length < interview.totalQuestions &&
    !isVisualCoachingMessage(text) &&
    !normalize(text).includes(normalize(CLOSING_LINE)) &&
    normalize(text) !== normalize(current.question)
  ) {
    turns.push({ question: text })
    await saveTurns(user.id, id, turns)
  }

  const answered = turns.filter((turn) => turn.answer !== undefined).length
  return Response.json({
    done: answered >= interview.totalQuestions,
    asked: turns.length,
    answered,
    total: interview.totalQuestions,
    currentQuestion: turns.at(-1)?.question ?? null,
  })
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}
