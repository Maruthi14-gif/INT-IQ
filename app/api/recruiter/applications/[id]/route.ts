import { z } from "zod"
import { apiApprovedRecruiter, jsonError } from "@/lib/api"
import { APPLICATION_STATUSES } from "@/lib/db/schema"
import { updateApplication } from "@/lib/recruiting"

const patch = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    recruiterNotes: z.string().max(4000).optional(),
  })
  .refine((v) => v.status !== undefined || v.recruiterNotes !== undefined, "Nothing to update.")

/** Recruiter updates an applicant's status (shortlist, reject…) or private notes. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiApprovedRecruiter()
  if (!user) return error
  const { id } = await params

  const parsed = patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid update.")

  const row = await updateApplication(user.id, id, {
    status: parsed.data.status,
    recruiterNotes: parsed.data.recruiterNotes?.trim() || (parsed.data.recruiterNotes === "" ? null : undefined),
  })
  if (!row) return jsonError(404, "Application not found.")
  return Response.json({ id: row.id, status: row.status })
}
