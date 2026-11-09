import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { InterviewRoom } from "@/components/interview/interview-room"
import { VoiceInterviewRoom } from "@/components/interview/voice-interview-room"
import { Skeleton } from "@/components/ui/skeleton"
import { getInterview } from "@/lib/interviews"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Interview in progress" }

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}

export default function InterviewRoomPage({ params, searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      }
    >
      <Room params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Room({ params, searchParams }: PageProps) {
  const { id } = await params
  const { mode } = await searchParams
  const user = await requireUser()
  const interview = await getInterview(user.id, id)
  if (!interview) notFound()
  if (interview.status === "completed") redirect(`/reports/${id}`)

  const last = interview.turns.at(-1)!
  const answered = interview.turns.filter((t) => t.answer !== undefined).length

  // Voice interviews use the Vapi call; `?mode=text` lets the candidate finish by typing instead.
  if (interview.mode === "voice" && mode !== "text") {
    return (
      <VoiceInterviewRoom
        id={interview.id}
        type={interview.type}
        targetRole={interview.targetRole}
        totalQuestions={interview.totalQuestions}
        initialAsked={interview.turns.length}
        initialAnswered={answered}
        initialQuestion={last.question}
      />
    )
  }

  return (
    <InterviewRoom
      id={interview.id}
      type={interview.type}
      targetRole={interview.targetRole}
      totalQuestions={interview.totalQuestions}
      initialQuestion={last.question}
      initialNumber={interview.turns.length}
      awaitingNext={last.answer !== undefined}
      startedAt={interview.startedAt.toISOString()}
    />
  )
}
