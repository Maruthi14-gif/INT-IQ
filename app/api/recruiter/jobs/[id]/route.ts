import { z } from "zod"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { getRecruiterProfile, isApprovedRecruiter } from "@/lib/recruiters"
import { JOB_STATUSES } from "@/lib/db/schema"
import { updateJob } from "@/lib/recruiting"
import { jobInput } from "@/lib/recruiting-schemas"

const patch = jobInput.partial().extend({ status: z.enum(JOB_STATUSES).optional() })

/** Edit a job, or change its status (draft → open → closed). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUserWithRole("recruiter")
  if (!user) return error
  const { id } = await params

  const parsed = patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Check the job details.")
  if (Object.keys(parsed.data).length === 0) return jsonError(400, "Nothing to update.")
  // Drafts can be edited any time; going live needs an approved recruiter.
  if (parsed.data.status === "open" && !isApprovedRecruiter(await getRecruiterProfile(user.id))) {
    return jsonError(403, "Your recruiter account is waiting for approval. You can publish jobs once an admin approves it.")
  }

  const job = await updateJob(user.id, id, parsed.data)
  if (!job) return jsonError(404, "Job not found.")
  return Response.json({ id: job.id, status: job.status })
}
