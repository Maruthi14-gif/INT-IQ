import "server-only"
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from "@ai-sdk/google"
import { generateText, Output, streamText, type LanguageModel } from "ai"
import type { z } from "zod"

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI isn't configured. Add GEMINI_API_KEY to the environment.")
  }
}

function apiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

export function isAiConfigured() {
  return Boolean(apiKey())
}

/**
 * "fast": interview turns, where latency matters (~1s with minimal thinking).
 * "smart": resume analysis and the final report, where quality matters (~5-10s).
 * Each has fallbacks in case the primary model is slow or unavailable.
 */
export type ModelKind = "fast" | "smart"

const MODELS: Record<ModelKind, { ids: string[]; timeoutMs: number; options?: GoogleLanguageModelOptions }> = {
  fast: {
    ids: [process.env.AI_FAST_MODEL ?? "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
    timeoutMs: 15_000,
    // Gemini 3 thinks before answering by default, which added 4-7s to every question.
    options: { thinkingConfig: { thinkingLevel: "minimal" } },
  },
  smart: {
    ids: [process.env.AI_SMART_MODEL ?? "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"],
    timeoutMs: 45_000,
  },
}

function models(kind: ModelKind): LanguageModel[] {
  const key = apiKey()
  if (!key) throw new AiNotConfiguredError()
  const google = createGoogleGenerativeAI({ apiKey: key })
  return [...new Set(MODELS[kind].ids)].map((id) => google(id))
}

function providerOptions(kind: ModelKind) {
  const options = MODELS[kind].options
  return options ? { google: options } : undefined
}

/** Structured output (validated with zod), with a time limit and model fallback. */
export async function generateStructured<S extends z.ZodType>(options: {
  kind: ModelKind
  schema: S
  system: string
  prompt: string
  temperature?: number
}): Promise<z.infer<S>> {
  let lastError: unknown
  for (const model of models(options.kind)) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: options.schema }),
        system: options.system,
        prompt: options.prompt,
        temperature: options.temperature ?? 0.6,
        maxRetries: 0, // on overload, move to the next model instead of waiting
        abortSignal: AbortSignal.timeout(MODELS[options.kind].timeoutMs),
        providerOptions: providerOptions(options.kind),
      })
      return output as z.infer<S>
    } catch (error) {
      lastError = error
      console.warn("[ai] model call failed, trying fallback:", error instanceof Error ? error.message : error)
    }
  }
  throw lastError
}

/* ── Streaming for the voice call ───────────────────────────── */

/** If the first model hasn't started talking by then, ask the next one too and use whichever is first. */
const HEDGE_MS = 1_500
const SPOKEN_TIMEOUT_MS = 12_000

type TextParts = AsyncIterator<{ type: string; text?: string; error?: unknown }>

async function firstWords(
  model: LanguageModel,
  options: { system: string; prompt: string; temperature?: number },
  signal: AbortSignal,
): Promise<{ text: string; rest: TextParts }> {
  const result = streamText({
    model,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature ?? 0.8,
    maxRetries: 0,
    abortSignal: AbortSignal.any([signal, AbortSignal.timeout(SPOKEN_TIMEOUT_MS)]),
    providerOptions: providerOptions("fast"),
  })
  const rest = result.fullStream[Symbol.asyncIterator]() as TextParts
  for (;;) {
    const { value, done } = await rest.next()
    if (done) throw new Error("The model returned no text.")
    if (value.type === "error") throw value.error
    if (value.type === "text-delta" && value.text?.trim()) return { text: value.text, rest }
  }
}

/**
 * Plain spoken text, streamed as it's generated so the voice can start on the first words.
 * Uses the fast models with hedging: a slow or failing model is overtaken by the next one.
 */
export async function* streamSpoken(options: { system: string; prompt: string; temperature?: number }): AsyncGenerator<string> {
  const candidates = models("fast")
  const controllers: AbortController[] = []

  const winner = await new Promise<{ index: number; text: string; rest: TextParts }>((resolve, reject) => {
    let launched = 0
    let failed = 0
    let settled = false
    let hedge: ReturnType<typeof setTimeout> | undefined
    const launch = () => {
      if (settled || launched >= candidates.length) return
      const index = launched++
      const controller = new AbortController()
      controllers.push(controller)
      firstWords(candidates[index], options, controller.signal).then(
        (started) => {
          if (settled) return controller.abort()
          settled = true
          clearTimeout(hedge)
          resolve({ index, ...started })
        },
        (error) => {
          failed++
          if (settled) return
          console.warn("[ai] spoken model failed, trying fallback:", error instanceof Error ? error.message : error)
          if (failed === candidates.length) {
            settled = true
            clearTimeout(hedge)
            reject(error)
          } else if (failed === launched) {
            launch() // nothing else is running: try the next model right away
          }
        },
      )
      clearTimeout(hedge)
      hedge = setTimeout(launch, HEDGE_MS)
    }
    launch()
  })

  controllers.forEach((c, i) => i !== winner.index && c.abort())
  try {
    yield winner.text
    for (;;) {
      const { value, done } = await winner.rest.next()
      if (done) return
      if (value.type === "error") throw value.error
      if (value.type === "text-delta" && value.text) yield value.text
    }
  } finally {
    controllers[winner.index]?.abort()
  }
}
