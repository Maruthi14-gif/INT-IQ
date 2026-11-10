import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import {
  appendLiveTranscript,
  completeLiveInterview,
  getLiveInterviewForUser,
  markLiveInterviewJoined,
  saveLiveEvaluation,
  saveLiveRecruiterNotes,
  setLiveTranscriptionConsent,
} from "@/lib/live-interviews"

const evaluation = z.object({
  summary: z.string().trim().min(1).max(900),
  strengths: z.array(z.string().trim().min(1).max(300)).max(5),
  weaknesses: z.array(z.string().trim().min(1).max(300)).max(5),
  evidence: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  recommendation: z.string().trim().min(1).max(500),
})

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join") }),
  z.object({ action: z.literal("transcription-consent"), consented: z.boolean() }),
  z.object({ action: z.literal("transcript"), text: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("notes"), notes: z.string().trim().max(6000) }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("approve-evaluation"), evaluation }),
])

function clientState(room: NonNullable<Awaited<ReturnType<typeof getLiveInterviewForUser>>>) {
  const { session, invitation, job, candidate, role } = room
  const recruiter = role === "recruiter"
  return {
    id: session.id,
    role,
    status: session.status,
    scheduledAt: invitation.scheduledAt?.toISOString() ?? null,
    recruiterJoined: Boolean(session.recruiterJoinedAt),
    candidateJoined: Boolean(session.candidateJoinedAt),
    transcription: {
      youConsented: recruiter ? Boolean(session.recruiterTranscriptionConsentAt) : Boolean(session.candidateTranscriptionConsentAt),
      otherConsented: recruiter ? Boolean(session.candidateTranscriptionConsentAt) : Boolean(session.recruiterTranscriptionConsentAt),
    },
    job: { title: job.title, company: job.company },
    candidateName: candidate.name?.trim() || candidate.email,
    // Recruiter-only data never crosses to the candidate browser.
    ...(recruiter
      ? {
          transcript: session.transcript,
          copilotPlan: session.copilotPlan,
          recruiterNotes: session.recruiterNotes,
          finalEvaluation: session.finalEvaluation,
        }
      : {}),
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params
  const room = await getLiveInterviewForUser(user.id, id)
  if (!room) return jsonError(404, "Live interview room not found.")
  return Response.json(clientState(room))
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Check the update details.")

  if (parsed.data.action === "join") {
    const room = await markLiveInterviewJoined(user.id, id)
    if (!room) return jsonError(404, "Live interview room is unavailable.")
    return Response.json(clientState(room))
  }
  if (parsed.data.action === "transcription-consent") {
    const room = await setLiveTranscriptionConsent(user.id, id, parsed.data.consented)
    if (!room) return jsonError(404, "Live interview room not found.")
    return Response.json(clientState(room))
  }
  if (parsed.data.action === "transcript") {
    const turn = await appendLiveTranscript(user.id, id, parsed.data.text)
    if (!turn) return jsonError(409, "Both participants must consent before transcription can be saved.")
    return Response.json({ turn })
  }
  if (parsed.data.action === "notes") {
    const saved = await saveLiveRecruiterNotes(user.id, id, parsed.data.notes)
    if (!saved) return jsonError(403, "Only the recruiter can save private interview notes.")
    return Response.json({ ok: true })
  }
  if (parsed.data.action === "complete") {
    const completed = await completeLiveInterview(user.id, id)
    if (!completed) return jsonError(403, "Only the recruiter can complete this live interview.")
    return Response.json({ ok: true })
  }

  const saved = await saveLiveEvaluation(user.id, id, { ...parsed.data.evaluation, approvedAt: new Date().toISOString() })
  if (!saved) return jsonError(403, "Only the recruiter can approve an evaluation.")
  return Response.json({ ok: true })
}
