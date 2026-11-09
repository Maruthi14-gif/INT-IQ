import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject, type LanguageModel } from "ai"
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

/** Primary model first, then a lighter fallback if the primary errors or is overloaded. */
function models(): LanguageModel[] {
  const key = apiKey()
  if (!key) throw new AiNotConfiguredError()
  const google = createGoogleGenerativeAI({ apiKey: key })
  const primary = process.env.AI_MODEL ?? "gemini-flash-latest"
  const fallback = process.env.AI_FALLBACK_MODEL ?? "gemini-flash-lite-latest"
  return primary === fallback ? [google(primary)] : [google(primary), google(fallback)]
}

/** Structured output (validated with zod), with model fallback. */
export async function generateStructured<S extends z.ZodType>(options: {
  schema: S
  system: string
  prompt: string
  temperature?: number
}): Promise<z.infer<S>> {
  let lastError: unknown
  for (const model of models()) {
    try {
      const { object } = await generateObject({
        model,
        schema: options.schema,
        system: options.system,
        prompt: options.prompt,
        temperature: options.temperature ?? 0.6,
        maxRetries: 1,
      })
      return object as z.infer<S>
    } catch (error) {
      lastError = error
      console.warn("[ai] model call failed, trying fallback:", error instanceof Error ? error.message : error)
    }
  }
  throw lastError
}
