import "server-only"
import { AiNotConfiguredError } from "@/lib/ai/model"
import { getSession } from "@/lib/session"

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

/** The signed-in user, or null. Route handlers must return 401 when this is null. */
export async function apiUser() {
  const session = await getSession()
  return session?.user ?? null
}

export function firstName(user: { name?: string | null; email: string }) {
  return user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0]
}

/** Turns an AI failure into a response the UI can show. */
export function aiError(error: unknown) {
  if (error instanceof AiNotConfiguredError) return jsonError(503, "The AI interviewer isn't set up yet (missing GEMINI_API_KEY).")
  console.error("[ai]", error)
  return jsonError(502, "The AI interviewer is busy right now. Please try again in a moment.")
}
