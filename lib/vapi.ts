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
  const secret = process.env.VAPI_LLM_SECRET ?? process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret) throw new Error("Set VAPI_LLM_SECRET (or NEON_AUTH_COOKIE_SECRET) to sign voice-agent requests.")
  return secret
}

/** Per-interview token Vapi sends back to our custom LLM endpoint. */
export function voiceAgentToken(interviewId: string) {
  return createHmac("sha256", signingSecret()).update(`vapi-llm:${interviewId}`).digest("base64url")
}

export function verifyVoiceAgentToken(interviewId: string, token: string | null) {
  if (!token) return false
  const expected = Buffer.from(voiceAgentToken(interviewId))
  const given = Buffer.from(token)
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
  return {
    name: "INT-IQ Interviewer",
    firstMessage: input.firstMessage,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "custom-llm",
      // Vapi appends /chat/completions.
      url: `${input.baseUrl}/api/vapi/llm/${input.interviewId}`,
      model: "int-iq-gemini-interviewer",
      headers: { "x-intiq-voice-token": voiceAgentToken(input.interviewId) },
      timeoutSeconds: 25,
      messages: [{ role: "system", content: "You are the INT-IQ mock interviewer." }],
    },
    voice: {
      provider: process.env.VAPI_VOICE_PROVIDER ?? "vapi",
      voiceId: process.env.VAPI_VOICE_ID ?? "Clara",
    },
    transcriber: { provider: "deepgram", model: "nova-3", language: process.env.VAPI_TRANSCRIBER_LANGUAGE ?? "en" },
    // Candidates pause to think: wait a little longer before treating silence as "done".
    startSpeakingPlan: {
      waitSeconds: 0.8,
      transcriptionEndpointingPlan: { onPunctuationSeconds: 1.2, onNoPunctuationSeconds: 2.5, onNumberSeconds: 1 },
    },
    endCallPhrases: [END_CALL_PHRASE],
    maxDurationSeconds: 30 * 60,
    metadata: { interviewId: input.interviewId, app: "int-iq" },
  }
}
