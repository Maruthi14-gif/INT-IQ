import { randomUUID } from "node:crypto"
import { after } from "next/server"
import { streamNextQuestion } from "@/lib/ai/interviewer"
import { firstName } from "@/lib/api"
import type { InterviewTurn } from "@/lib/db/schema"
import { getInterviewForVoiceAgent, saveTurns, saveTurnsIfUnchanged } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { CLOSING_LINE, verifyVoiceAgentToken } from "@/lib/vapi"
import { isVisualCoachingMessage } from "@/lib/visual-coaching"

export const maxDuration = 60

const LOST = "Sorry, I lost my train of thought for a second. Could you tell me a little more about that?"

/**
 * Vapi "custom LLM" endpoint (OpenAI chat-completions format).
 * Called by Vapi each time the candidate finishes speaking: we save the transcribed
 * answer and stream back the next question from the Gemini interviewer, so voice
 * and text interviews share the same adaptive logic and storage.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!verifyVoiceAgentToken(id, request.headers.get("x-intiq-voice-token"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const streaming = body?.stream !== false
  const say = (text: string) => {
    const out = speech(streaming)
    out.send(text)
    return out.end()
  }

  const row = await getInterviewForVoiceAgent(id)
  if (!row) return say("Sorry, I couldn't find this interview. Please restart it from the app.")
  const { interview } = row
  if (interview.status === "completed") return say(CLOSING_LINE)

  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
  const turns = interview.turns
  const { index, answer } = whatWasAnswered(turns, messages)
  const current = turns[index]
  const later = turns.slice(index + 1)

  if (!answer) return say(current.answer === undefined ? current.question : "Take your time. Go on whenever you're ready.")
  // A late request about an older question: never drop answers given since.
  if (later.some((t) => t.answer !== undefined)) return say(turns.at(-1)!.answer === undefined ? turns.at(-1)!.question : CLOSING_LINE)

  const alreadySaved = Boolean(current.answer && normalize(current.answer).includes(normalize(answer)))
  // Vapi retried a request we already handled: the next question is ready.
  if (alreadySaved && later[0]) return say(later[0].question)

  // Everything said since the question is the answer. Questions written after it were never heard.
  const heard: InterviewTurn[] = turns.slice(0, index + 1)
  if (!alreadySaved) {
    heard[index] = { ...current, answer, answeredAt: new Date().toISOString() }
    await saveTurns(interview.userId, interview.id, heard)
  }
  if (heard.length >= interview.totalQuestions) return say(CLOSING_LINE)

  const out = speech(streaming)
  const work = (async () => {
    let question = ""
    try {
      const profile = await getOrCreateProfile(interview.userId)
      const stream = streamNextQuestion({
        type: interview.type,
        targetRole: interview.targetRole,
        profile,
        firstName: firstName({ name: row.name, email: row.email }),
        turns: heard,
        totalQuestions: interview.totalQuestions,
      })
      for await (const text of stream) {
        question += text
        out.send(text)
      }
    } catch (error) {
      console.error("[vapi-llm] next question failed", error)
      // The answer is saved; the next request (or a reconnect) writes the next question.
      if (!question.trim()) out.send(LOST)
    }
    if (streaming) out.end()
    question = question.replace(/\s+/g, " ").trim()
    // Saved even if the candidate interrupts, unless a newer request changed the interview meanwhile.
    if (question) {
      await saveTurnsIfUnchanged(interview.userId, interview.id, heard, [...heard, { question }]).catch((error) =>
        console.error("[vapi-llm] couldn't save the next question", error),
      )
    }
  })()

  if (!streaming) {
    await work
    return out.end()
  }
  // Keep the function alive until the question is saved, even if Vapi closes the stream early.
  after(() => work)
  return out.response ?? out.end()
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

/** The first words of a question: enough to recognise it in what the interviewer said. */
function opening(question: string) {
  return normalize(question).split(" ").slice(0, 10).join(" ")
}

function userSpeech(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user")
    .map(textOf)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Which question the candidate is answering (the last one they actually heard) and
 * everything they've said since. Fillers, "take your time" and repeats are skipped,
 * so an answer given in several parts stays one answer.
 */
function whatWasAnswered(turns: InterviewTurn[], messages: ChatMessage[]) {
  for (let m = messages.length - 1; m >= 0; m--) {
    if (messages[m].role !== "assistant") continue
    const said = normalize(textOf(messages[m]))
    for (let t = turns.length - 1; t >= 0; t--) {
      const start = opening(turns[t].question)
      if (start && said.includes(start)) return { index: t, answer: userSpeech(messages.slice(m + 1)) }
    }
  }
  // Fallback: the newest question, with what was said since the interviewer last spoke.
  const lastAssistant = messages.findLastIndex(
    (m) => m.role === "assistant" && !isVisualCoachingMessage(textOf(m)),
  )
  return { index: turns.length - 1, answer: userSpeech(messages.slice(lastAssistant + 1)) }
}

/**
 * OpenAI-compatible reply. Streamed (SSE) when Vapi asks for a stream, so the voice starts
 * speaking on the first words; plain JSON otherwise.
 */
function speech(streaming: boolean) {
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const model = "int-iq-gemini-interviewer"

  if (!streaming) {
    let text = ""
    return {
      send: (part: string) => void (text += part),
      end: () =>
        Response.json({
          id,
          object: "chat.completion",
          created,
          model,
          choices: [{ index: 0, message: { role: "assistant", content: text.trim() }, finish_reason: "stop" }],
        }),
      response: null,
    }
  }

  const encoder = new TextEncoder()
  const chunk = (delta: object, finish: string | null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let open = true
  const readable = new ReadableStream<Uint8Array>({
    start: (c) => void (controller = c),
    cancel: () => void (open = false), // Vapi hung up or the candidate interrupted
  })
  const push = (text: string) => {
    if (!open) return
    try {
      controller.enqueue(encoder.encode(text))
    } catch {
      open = false
    }
  }
  push(chunk({ role: "assistant", content: "" }, null))
  const response = new Response(readable, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  })

  return {
    send: (text: string) => text && push(chunk({ content: text }, null)),
    end: () => {
      if (open) {
        push(chunk({}, "stop") + "data: [DONE]\n\n")
        open = false
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      return response
    },
    response,
  }
}

/** Lets the voice room wake this function up when a call starts, so the first answer isn't slowed by a cold start. */
export function GET() {
  return new Response(null, { status: 204 })
}
