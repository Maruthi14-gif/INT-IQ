import "server-only"
import { AiNotConfiguredError } from "@/lib/ai/model"
import type { UserRole } from "@/lib/db/schema"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession } from "@/lib/session"

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

/** The signed-in user, or null. Route handlers must return 401 when this is null. */
export async function apiUser() {
  const session = await getSession()
  return session?.user ?? null
}

/** The signed-in user if they have the given role, else null. Routes return 401/403 themselves. */
export async function apiUserWithRole(role: UserRole) {
  const user = await apiUser()
  if (!user) return { user: null, error: jsonError(401, "Please sign in again.") }
  const profile = await getOrCreateProfile(user.id)
  if (!profile.roleChosen || profile.role !== role) return { user: null, error: jsonError(403, "You don't have access to this.") }
  return { user, profile, error: null }
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
