import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import { ensureLiveInterviewForInvitation } from "@/lib/live-interviews"

const body = z.object({ invitationId: z.string().uuid() })

/** Opens the participant-only room for a live invitation, including older invitations created before rooms existed. */
export async function POST(request: Request) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Invalid invitation.")
  const room = await ensureLiveInterviewForInvitation(user.id, parsed.data.invitationId)
  if (!room) return jsonError(404, "Live interview invitation not found.")
  return Response.json({ id: room.session.id })
}
