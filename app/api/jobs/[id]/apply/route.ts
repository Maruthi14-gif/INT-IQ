import { z } from "zod"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { applyToJob } from "@/lib/recruiting"

const body = z.object({ coverNote: z.string().trim().max(1500).optional() })

/** Candidate applies to an open job. One application per job. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile, error } = await apiUserWithRole("student")
  if (!user) return error
  const { id } = await params

  const parsed = body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return jsonError(400, "Your note is too long.")
  if (!profile.resumeText) return jsonError(400, "Add your resume first, so the recruiter can see it.")

  const result = await applyToJob(user.id, id, parsed.data.coverNote || null)
  if (!result) return jsonError(404, "This job isn't open.")
  if (result === "exists") return jsonError(409, "You've already applied to this job.")
  return Response.json({ id: result.id })
}
