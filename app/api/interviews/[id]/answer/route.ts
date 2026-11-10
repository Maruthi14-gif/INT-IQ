import { z } from "zod"
import { buildReport, nextQuestion } from "@/lib/ai/interviewer"
import { aiError, apiUserWithRole, firstName, jsonError } from "@/lib/api"
import { completeInterview, getInterview, saveTurns } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { rateLimited } from "@/lib/rate-limit"

export const maxDuration = 60

const body = z.object({ answer: z.string().max(6000) })

/**
 * Save the answer to the current question, then either ask the next question
 * or (after the last one) grade the interview. The answer is saved before any AI
 * call, so retrying after an AI error never loses it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error
  const limited = await rateLimited("interview-answer", user.id)
  if (limited) return limited
  const { id } = await params

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Answer is missing.")

  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.status === "completed") return Response.json({ done: true })

  const turns = [...interview.turns]
  const current = turns.at(-1)
  if (current && current.answer === undefined) {
    turns[turns.length - 1] = { ...current, answer: parsed.data.answer.trim(), answeredAt: new Date().toISOString() }
    await saveTurns(user.id, id, turns)
  }

  const profile = await getOrCreateProfile(user.id)

  try {
    if (turns.length >= interview.totalQuestions) {
      const report = await buildReport({ type: interview.type, targetRole: interview.targetRole, profile, turns })
      await completeInterview(user.id, id, turns, report)
      return Response.json({ done: true })
    }

    const question = await nextQuestion({
      type: interview.type,
      targetRole: interview.targetRole,
      profile,
      firstName: firstName(user),
      turns,
      totalQuestions: interview.totalQuestions,
    })
    turns.push({ question })
    await saveTurns(user.id, id, turns)
    return Response.json({ done: false, question, number: turns.length })
  } catch (error) {
    return aiError(error)
  }
}
