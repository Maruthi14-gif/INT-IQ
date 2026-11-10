import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import { USER_ROLES } from "@/lib/db/schema"
import { getOrCreateProfile } from "@/lib/profiles"
import { setRole } from "@/lib/recruiting"
import { homeFor } from "@/lib/session"

const body = z.object({ role: z.enum(USER_ROLES) })

/** Select the active workspace after sign-in. A user can switch roles without a second account. */
export async function POST(request: Request) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Pick student or recruiter.")

  await getOrCreateProfile(user.id)
  await setRole(user.id, parsed.data.role)
  return Response.json({ next: homeFor(parsed.data.role) })
}
