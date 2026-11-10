import { z } from "zod"
import { apiAdmin, jsonError } from "@/lib/api"
import { reviewRecruiter } from "@/lib/recruiters"

const body = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approved"), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal("rejected"), note: z.string().trim().min(3, "Tell the recruiter why, in a few words.").max(500) }),
])

/** An admin approves or declines a recruiter account. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiAdmin()
  if (!user) return error
  const { id } = await params

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Choose approve or decline.")

  const row = await reviewRecruiter(user.id, id, parsed.data.decision, parsed.data.note || null)
  if (!row) return jsonError(404, "Recruiter not found.")
  return Response.json({ status: row.status })
}
