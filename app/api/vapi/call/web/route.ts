import { nextQuestion } from "@/lib/ai/interviewer"
import { aiError, apiUser, firstName, jsonError } from "@/lib/api"
import { getInterview, saveTurns } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { buildVoiceAssistant, isVoiceConfigured, VAPI_API, vapiPublicKey, voiceAgentBaseUrl } from "@/lib/vapi"

export const maxDuration = 60

/**
 * Proxy for the Vapi Web SDK (it posts here instead of api.vapi.ai).
 * The browser only sends the interview id; the assistant config and the Vapi key
 * stay on the server.
 */
export async function POST(request: Request) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  if (!isVoiceConfigured()) return jsonError(503, "Voice interviews aren't set up yet (missing VAPI_PUBLIC_KEY).")

  const body = await request.json().catch(() => ({}))
  const interviewId = String(body?.assistantOverrides?.metadata?.interviewId ?? "")
  const interview = await getInterview(user.id, interviewId)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.status === "completed") return jsonError(409, "This interview is already finished.")

  const turns = [...interview.turns]
  const answered = turns.filter((t) => t.answer !== undefined).length
  if (answered >= interview.totalQuestions) return jsonError(409, "All questions are answered. Get your report.")

  // A dropped call can leave the last question answered with no next question yet.
  if (turns.at(-1)?.answer !== undefined) {
    try {
      const profile = await getOrCreateProfile(user.id)
      const question = await nextQuestion({
        type: interview.type,
        targetRole: interview.targetRole,
        profile,
        firstName: firstName(user),
        turns,
        totalQuestions: interview.totalQuestions,
      })
      turns.push({ question })
      await saveTurns(user.id, interview.id, turns)
    } catch (error) {
      return aiError(error)
    }
  }

  const current = turns.at(-1)!.question
  const assistant = buildVoiceAssistant({
    interviewId: interview.id,
    firstMessage: answered > 0 ? `Welcome back, let's pick up where we left off. ${current}` : current,
    baseUrl: voiceAgentBaseUrl(request.url),
  })

  let response: Response
  try {
    response = await fetch(`${VAPI_API}/call/web`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${vapiPublicKey()}`,
        "content-type": "application/json",
        // The key only accepts its allowed origins (set in the Vapi dashboard).
        origin: new URL(request.url).origin,
      },
      body: JSON.stringify({ assistant, roomDeleteOnUserLeaveEnabled: body?.roomDeleteOnUserLeaveEnabled }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    console.error("[vapi] could not reach Vapi", error)
    return jsonError(502, "Couldn't reach the voice service. Check your connection and try again.")
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error("[vapi] call creation failed", response.status, JSON.stringify(data).slice(0, 500))
    return jsonError(502, "The voice service didn't start the call. Please try again.")
  }

  // Don't hand our assistant config (it carries the agent's secret header) to the browser.
  const call = Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([key]) => key !== "assistant" && key !== "assistantOverrides"),
  )
  return Response.json(call)
}
