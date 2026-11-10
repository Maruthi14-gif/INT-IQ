import { z } from "zod"
import { nextQuestion } from "@/lib/ai/interviewer"
import { aiError, apiUserWithRole, firstName, jsonError } from "@/lib/api"
import { INTERVIEW_MODES, INTERVIEW_TYPES } from "@/lib/db/schema"
import { createInterview } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { attachInterviewToInvitation, getMyInvitation } from "@/lib/recruiting"
import { isVoiceConfigured } from "@/lib/vapi"

export const maxDuration = 60

const body = z.object({
  type: z.enum(INTERVIEW_TYPES),
  totalQuestions: z.number().int().min(3).max(10),
  mode: z.enum(INTERVIEW_MODES).default("text"),
  /** A recruiter's invitation: the round and length come from it, and the report goes to the recruiter. */
  invitationId: z.uuid().optional(),
})

/** Start an interview: create it and ask the first question. */
export async function POST(request: Request) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Pick a round and number of questions.")
  let { type, totalQuestions } = parsed.data
  const { mode, invitationId } = parsed.data
  if (mode === "voice" && !isVoiceConfigured()) return jsonError(400, "Voice interviews aren't set up yet. Use text mode for now.")

  const profile = await getOrCreateProfile(user.id)
  let targetRole = profile.targetRole ?? "Software Developer"
  let applicationId: string | null = null

  if (invitationId) {
    const invite = await getMyInvitation(user.id, invitationId)
    if (!invite || invite.invitation.kind !== "ai") return jsonError(404, "Invitation not found.")
    if (invite.invitation.status === "completed") return jsonError(409, "You've already completed this interview.")
    if (invite.invitation.interviewId) return Response.json({ id: invite.invitation.interviewId })
    type = invite.invitation.interviewType ?? type
    totalQuestions = invite.invitation.totalQuestions ?? totalQuestions
    targetRole = invite.job.title
    applicationId = invite.application.id
  }

  try {
    const question = await nextQuestion({
      type,
      targetRole,
      profile,
      firstName: firstName(user),
      turns: [],
      totalQuestions,
    })
    const interview = await createInterview(user.id, { type, mode, targetRole, totalQuestions, firstQuestion: question, applicationId })
    if (invitationId) await attachInterviewToInvitation(invitationId, interview.id)
    return Response.json({ id: interview.id })
  } catch (error) {
    return aiError(error)
  }
}
