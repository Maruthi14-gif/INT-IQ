import { randomUUID } from "node:crypto"
import { nextQuestion } from "@/lib/ai/interviewer"
import { firstName } from "@/lib/api"
import { getInterviewForVoiceAgent, saveTurns } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { CLOSING_LINE, verifyVoiceAgentToken } from "@/lib/vapi"

export const maxDuration = 60

/**
 * Vapi "custom LLM" endpoint (OpenAI chat-completions format).
 * Called by Vapi each time the candidate finishes speaking: we save the transcribed
 * answer and reply with the next question from the Gemini interviewer, so voice
 * and text interviews share the same adaptive logic and storage.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!verifyVoiceAgentToken(id, request.headers.get("x-intiq-voice-token"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const say = (text: string) => reply(text, body?.stream !== false)

  const row = await getInterviewForVoiceAgent(id)
  if (!row) return say("Sorry, I couldn't find this interview. Please restart it from the app.")
  const { interview } = row
  if (interview.status === "completed") return say(CLOSING_LINE)

  // Everything the candidate said since the interviewer last spoke.
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
  let lastAssistant = -1
  messages.forEach((m, i) => {
    if (m.role === "assistant") lastAssistant = i
  })
  const spoken = messages
    .slice(lastAssistant + 1)
    .filter((m) => m.role === "user")
    .map(textOf)
    .join(" ")
    .trim()

  const turns = [...interview.turns]
  const current = turns.at(-1)!
  if (!spoken) return say(current.answer === undefined ? current.question : "Take your time. Go on whenever you're ready.")

  // Vapi retried a request we already handled: the answer is saved and the next question waits.
  const previous = turns.at(-2)
  if (current.answer === undefined && previous?.answer && normalize(previous.answer).endsWith(normalize(spoken))) {
    return say(current.question)
  }

  turns[turns.length - 1] = {
    ...current,
    // If the candidate keeps talking after an interruption, add it to the same answer.
    answer: current.answer ? `${current.answer} ${spoken}` : spoken,
    answeredAt: new Date().toISOString(),
  }
  await saveTurns(interview.userId, interview.id, turns)

  if (turns.length >= interview.totalQuestions) return say(CLOSING_LINE)

  try {
    const profile = await getOrCreateProfile(interview.userId)
    const question = await nextQuestion({
      type: interview.type,
      targetRole: interview.targetRole,
      profile,
      firstName: firstName({ name: row.name, email: row.email }),
      turns,
      totalQuestions: interview.totalQuestions,
    })
    turns.push({ question })
    await saveTurns(interview.userId, interview.id, turns)
    return say(question)
  } catch (error) {
    console.error("[vapi-llm] next question failed", error)
    // The answer is saved; the next request (or a reconnect) generates the next question.
    return say("Sorry, I lost my train of thought for a second. Could you tell me a little more about that?")
  }
}

type ChatMessage = { role?: string; content?: string | { type?: string; text?: string }[] | null }

function textOf(message: ChatMessage) {
  if (typeof message.content === "string") return message.content
  if (Array.isArray(message.content)) return message.content.map((p) => p?.text ?? "").join(" ")
  return ""
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** OpenAI-compatible reply, streamed (SSE) when Vapi asks for a stream. */
function reply(text: string, stream: boolean) {
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const model = "int-iq-gemini-interviewer"
  if (!stream) {
    return Response.json({
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    })
  }
  const chunk = (delta: object, finish: string | null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
  return new Response(chunk({ role: "assistant", content: text }, null) + chunk({}, "stop") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  })
}
