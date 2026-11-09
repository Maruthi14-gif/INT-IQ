import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, Output, type LanguageModel } from "ai"
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
 * "fast": interview turns, where latency matters (measured ~1.3s).
 * "smart": resume analysis and the final report, where quality matters (~5s).
 * Each has a fallback in case the primary model is slow or unavailable.
 */
export type ModelKind = "fast" | "smart"

const MODELS: Record<ModelKind, { ids: string[]; timeoutMs: number }> = {
  fast: {
    ids: [process.env.AI_FAST_MODEL ?? "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash-lite"],
    timeoutMs: 15_000,
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
      })
      return output as z.infer<S>
    } catch (error) {
      lastError = error
      console.warn("[ai] model call failed, trying fallback:", error instanceof Error ? error.message : error)
    }
  }
  throw lastError
}
