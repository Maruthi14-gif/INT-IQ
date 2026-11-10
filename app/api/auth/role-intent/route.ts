import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import { USER_ROLES } from "@/lib/db/schema"
import { saveRoleIntent } from "@/lib/auth/role-intent"

const body = z.object({ role: z.enum(USER_ROLES) })

/** Stores a short-lived, signed role choice before the external auth redirect. */
export async function POST(request: Request) {
  if (await apiUser()) return jsonError(409, "Sign out before starting a new sign-in.")

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Choose a candidate or recruiter workspace.")

  await saveRoleIntent(parsed.data.role)
  return Response.json({ ok: true })
}
