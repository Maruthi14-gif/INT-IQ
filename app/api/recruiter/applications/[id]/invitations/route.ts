import { z } from "zod"
import { apiApprovedRecruiter, jsonError } from "@/lib/api"
import { INTERVIEW_TYPES } from "@/lib/db/schema"
import { createInvitation } from "@/lib/recruiting"

const body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ai"),
    interviewType: z.enum(INTERVIEW_TYPES),
    totalQuestions: z.number().int().min(3).max(10),
    message: z.string().trim().max(1000).optional(),
  }),
  z.object({
    kind: z.literal("live"),
    scheduledAt: z.iso.datetime(),
    message: z.string().trim().max(1000).optional(),
  }),
])

/** Recruiter invites the applicant to an AI interview or schedules a live one. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiApprovedRecruiter()
  if (!user) return error
  const { id } = await params

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Check the invitation details.")
  const data = parsed.data

  if (data.kind === "live" && new Date(data.scheduledAt).getTime() < Date.now()) {
    return jsonError(400, "Pick a time in the future.")
  }

  const invitation = await createInvitation(user.id, id, {
    kind: data.kind,
    interviewType: data.kind === "ai" ? data.interviewType : undefined,
    totalQuestions: data.kind === "ai" ? data.totalQuestions : undefined,
    scheduledAt: data.kind === "live" ? new Date(data.scheduledAt) : undefined,
    message: data.message || null,
  })
  if (!invitation) return jsonError(404, "Application not found.")
  return Response.json({ id: invitation.id })
}
