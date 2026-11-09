import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Vapi voice interviews.
 *
 * Vapi handles the call audio (speech-to-text and text-to-speech). Every time the
 * candidate finishes speaking, Vapi asks our "custom LLM" endpoint what to say next,
 * and that endpoint uses the same Gemini interviewer as text mode. The assistant
 * config (including that endpoint's secret header) is built here on the server and
 * sent to Vapi from the server, so neither ever reaches the browser.
 */

export const VAPI_API = "https://api.vapi.ai"

/** Said at the end of the last answer; Vapi hangs up when the assistant says it. */
export const CLOSING_LINE = "Thank you, that's all my questions. I'm preparing your report now."
const END_CALL_PHRASE = "preparing your report now"

/**
 * Vapi web calls (/call/web) are created with the *public* key plus an allowed Origin.
 * We only use it on the server (the browser SDK talks to our proxy), so it never ships
 * in client code even though Vapi calls it public.
 */
export function vapiPublicKey() {
  return process.env.VAPI_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? ""
}

export function isVoiceConfigured() {
  return Boolean(vapiPublicKey())
}

function signingSecret() {
  const secret = process.env.VAPI_LLM_SECRET || process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret) throw new Error("Set VAPI_LLM_SECRET (or NEON_AUTH_COOKIE_SECRET) to sign voice-agent requests.")
  return secret
}

/** Vapi hangs up after this long. The agent token expires 15 minutes later. */
const MAX_CALL_SECONDS = 20 * 60

function sign(interviewId: string, exp: number) {
  return createHmac("sha256", signingSecret()).update(`vapi-llm:${interviewId}:${exp}`).digest("base64url")
}

/** Per-interview token Vapi sends back to our custom LLM endpoint: `<exp unix seconds>.<hmac>`. */
export function voiceAgentToken(interviewId: string, exp: number) {
  return `${exp}.${sign(interviewId, exp)}`
}

export function verifyVoiceAgentToken(interviewId: string, token: string | null) {
  const match = /^([1-9]\d{0,11})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "")
  if (!match) return false
  const exp = Number(match[1])
  if (exp * 1000 < Date.now()) return false
  const expected = Buffer.from(sign(interviewId, exp))
  const given = Buffer.from(match[2])
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Public base URL Vapi uses to reach our custom LLM endpoint. On Vercel it's the site
 * itself. Locally, Vapi can't reach localhost: set VAPI_LLM_BASE_URL to a tunnel URL.
 */
export function voiceAgentBaseUrl(requestUrl: string) {
  return (process.env.VAPI_LLM_BASE_URL ?? new URL(requestUrl).origin).replace(/\/+$/, "")
}

export function buildVoiceAssistant(input: { interviewId: string; firstMessage: string; baseUrl: string }) {
  const language = process.env.VAPI_TRANSCRIBER_LANGUAGE ?? "en"
  const exp = Math.floor(Date.now() / 1000) + MAX_CALL_SECONDS + 15 * 60
  return {
    name: "INT-IQ Interviewer",
    firstMessage: input.firstMessage,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "custom-llm",
      // Vapi appends /chat/completions.
      url: `${input.baseUrl}/api/vapi/llm/${input.interviewId}`,
      model: "int-iq-gemini-interviewer",
      headers: { "x-intiq-voice-token": voiceAgentToken(input.interviewId, exp) },
      timeoutSeconds: 25,
      messages: [{ role: "system", content: "You are the INT-IQ mock interviewer." }],
    },
    voice: {
      provider: process.env.VAPI_VOICE_PROVIDER ?? "vapi",
      voiceId: process.env.VAPI_VOICE_ID ?? "Clara",
      // Speak short chunks right away, so "Got it." plays while the question is still being written.
      chunkPlan: { enabled: true, minCharacters: 4 },
    },
    transcriber: { provider: "deepgram", model: "nova-3", language },
    startSpeakingPlan: {
      waitSeconds: 0.4,
      // A model judges whether the sentence sounds finished: quick reply after a complete answer,
      // patient during "so, um..." thinking pauses. English only.
      ...(language.startsWith("en") && {
        smartEndpointingPlan: { provider: "livekit", waitFunction: "70 + 600 * sqrt(x) + 3000 * x^3" },
      }),
      transcriptionEndpointingPlan: { onPunctuationSeconds: 0.6, onNoPunctuationSeconds: 1.6, onNumberSeconds: 0.8 },
    },
    endCallPhrases: [END_CALL_PHRASE],
    maxDurationSeconds: MAX_CALL_SECONDS,
    metadata: { interviewId: input.interviewId, app: "int-iq" },
  }
}
