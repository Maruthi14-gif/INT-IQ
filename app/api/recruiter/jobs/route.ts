import { apiUserWithRole, jsonError } from "@/lib/api"
import { createJob } from "@/lib/recruiting"
import { jobInput } from "@/lib/recruiting-schemas"

/** Recruiter creates a job (as a draft). */
export async function POST(request: Request) {
  const { user, error } = await apiUserWithRole("recruiter")
  if (!user) return error

  const parsed = jobInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Check the job details.")

  const job = await createJob(user.id, parsed.data)
  return Response.json({ id: job.id })
}
