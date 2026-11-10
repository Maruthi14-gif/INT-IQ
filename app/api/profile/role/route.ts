import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import { USER_ROLES } from "@/lib/db/schema"
import { chooseInitialRole, getOrCreateProfile } from "@/lib/profiles"
import { homeFor } from "@/lib/session"

const body = z.object({ role: z.enum(USER_ROLES) })

/** Saves a first-time workspace choice without allowing established roles to change. */
export async function POST(request: Request) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Pick a candidate or recruiter workspace.")

  const current = await getOrCreateProfile(user.id)
  if (current.roleChosen && current.role !== parsed.data.role) {
    return jsonError(409, "This account already has a different workspace. Sign out and use another account to continue.")
  }
  const profile = current.roleChosen ? current : await chooseInitialRole(user.id, parsed.data.role)
  if (profile.role !== parsed.data.role) {
    return jsonError(409, "This account already has a different workspace. Sign out and use another account to continue.")
  }
  return Response.json({ next: homeFor(profile.role) })
}
