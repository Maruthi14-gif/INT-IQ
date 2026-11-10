import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { LiveInterviewRoom, type LiveRoomData } from "@/components/recruiting/live-interview-room"
import { Skeleton } from "@/components/ui/skeleton"
import { getLiveInterviewForUser } from "@/lib/live-interviews"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Live interview" }

type Props = { params: Promise<{ id: string }> }

export default function LiveInterviewPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-7xl space-y-5"><Skeleton className="h-12 w-80" /><Skeleton className="h-[520px] rounded-2xl" /></div>}>
      <Room params={params} />
    </Suspense>
  )
}

async function Room({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const room = await getLiveInterviewForUser(user.id, id)
  if (!room) notFound()
  const recruiter = room.role === "recruiter"
  const initial: LiveRoomData = {
    id: room.session.id,
    role: room.role,
    status: room.session.status,
    scheduledAt: room.invitation.scheduledAt?.toISOString() ?? null,
    recruiterJoined: Boolean(room.session.recruiterJoinedAt),
    candidateJoined: Boolean(room.session.candidateJoinedAt),
    transcription: {
      youConsented: recruiter ? Boolean(room.session.recruiterTranscriptionConsentAt) : Boolean(room.session.candidateTranscriptionConsentAt),
      otherConsented: recruiter ? Boolean(room.session.candidateTranscriptionConsentAt) : Boolean(room.session.recruiterTranscriptionConsentAt),
    },
    job: { title: room.job.title, company: room.job.company },
    candidateName: room.candidate.name?.trim() || room.candidate.email,
    ...(recruiter
      ? {
          transcript: room.session.transcript,
          copilotPlan: room.session.copilotPlan,
          recruiterNotes: room.session.recruiterNotes,
          finalEvaluation: room.session.finalEvaluation,
        }
      : {}),
  }
  return <LiveInterviewRoom initial={initial} />
}
