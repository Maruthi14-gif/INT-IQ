import { z } from "zod"
import { draftLiveEvaluation, buildCopilotPlan, suggestCopilotFollowUps } from "@/lib/ai/copilot"
import { aiError, apiUser, jsonError } from "@/lib/api"
import { getLiveInterviewForUser, saveCopilotPlan } from "@/lib/live-interviews"
import { rateLimited } from "@/lib/rate-limit"

const body = z.object({ action: z.enum(["plan", "suggestions", "evaluation-draft"]) })

/** Gemini-backed recruiter Copilot. It only returns assistance; it never changes an application outcome. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Invalid Copilot request.")
  const room = await getLiveInterviewForUser(user.id, id)
  if (!room) return jsonError(404, "Live interview room not found.")
  if (room.role !== "recruiter") return jsonError(403, "The Copilot is available only to the recruiter.")
  const limited = await rateLimited("copilot", user.id)
  if (limited) return limited

  const input = {
    candidateName: room.candidate.name?.trim() || room.candidate.email,
    profile: room.profile,
    job: room.job,
  }
  try {
    if (parsed.data.action === "plan") {
      const plan = await buildCopilotPlan(input)
      await saveCopilotPlan(user.id, id, plan)
      return Response.json({ plan })
    }
    if (parsed.data.action === "suggestions") {
      if (!room.session.recruiterTranscriptionConsentAt || !room.session.candidateTranscriptionConsentAt) {
        return jsonError(409, "Both participants must consent before the Copilot uses a transcript.")
      }
      const suggestions = await suggestCopilotFollowUps({ ...input, turns: room.session.transcript })
      return Response.json({ suggestions })
    }
    const draft = await draftLiveEvaluation({ ...input, turns: room.session.transcript, recruiterNotes: room.session.recruiterNotes })
    return Response.json({ draft })
  } catch (error) {
    return aiError(error)
  }
}
