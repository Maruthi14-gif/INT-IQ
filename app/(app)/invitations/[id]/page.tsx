import { CalendarIcon, ScanFaceIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { StartInvitedInterview } from "@/components/recruiting/start-invited-interview"
import { JoinLiveInterviewButton } from "@/components/recruiting/join-live-interview"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyInvitation } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"
import { isVoiceConfigured } from "@/lib/vapi"

export const metadata: Metadata = { title: "Interview invitation" }

type Props = { params: Promise<{ id: string }> }
const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const

export default function InvitationPage({ params }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Invitation params={params} />
      </Suspense>
    </div>
  )
}

async function Invitation({ params }: Props) {
  const { id } = await params
  const { user } = await requireRole("student")
  const row = await getMyInvitation(user.id, id)
  if (!row) notFound()
  const { invitation, job } = row

  // Already started or done: go straight there.
  if (invitation.interviewId) {
    redirect(invitation.status === "completed" ? `/reports/${invitation.interviewId}` : `/interview/${invitation.interviewId}`)
  }

  return (
    <>
      <div className="space-y-2">
        <Link href="/applications" className="text-sm text-muted-foreground hover:text-foreground">
          ← My applications
        </Link>
        <h1 className="text-3xl font-medium">
          {invitation.kind === "ai" ? "Interview for " : "Live interview for "}
          <span>{job.title}</span>
        </h1>
        <p className="text-muted-foreground">{job.company}</p>
      </div>

      {invitation.message && (
        <blockquote className="rounded-2xl border bg-card px-5 py-4 text-sm leading-relaxed">
          <span className="block text-xs font-medium text-muted-foreground">From the recruiter</span>
          <span className="mt-1 block">{invitation.message}</span>
        </blockquote>
      )}

      {invitation.kind === "live" ? (
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <p className="flex items-center gap-2 font-medium">
            <CalendarIcon className="size-4 text-brand-text" />
            {invitation.scheduledAt?.toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-sm text-muted-foreground">
            This is a private camera-and-microphone conversation with a person from {job.company}. Open the room when it&rsquo;s time to join. Warm up with a mock interview first if you like.
          </p>
          <div className="flex flex-wrap gap-2">
            <JoinLiveInterviewButton invitationId={invitation.id} />
            <Button asChild variant="outline" className="h-10 px-4"><Link href="/interview">Practice first</Link></Button>
          </div>
        </section>
      ) : (
        <section className="space-y-5 rounded-2xl border bg-card p-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Round</dt>
              <dd className="font-medium">{invitation.interviewType ? ROUND_LABEL[invitation.interviewType] : "Technical"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Questions</dt>
              <dd className="font-medium">{invitation.totalQuestions ?? 5}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-medium">about {(invitation.totalQuestions ?? 5) * 2} min</dd>
            </div>
          </dl>
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <ScanFaceIcon className="size-4" /> This one counts
            </p>
            <p className="mt-1 text-muted-foreground">
              The recruiter at {job.company} receives your full report: scores, every answer, and the camera presence check. You can take it once, so find a quiet spot.
            </p>
          </div>
          <StartInvitedInterview invitationId={invitation.id} voiceAvailable={isVoiceConfigured()} />
        </section>
      )}
    </>
  )
}
