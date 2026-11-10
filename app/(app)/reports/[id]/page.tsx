import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { ReportView } from "@/components/report/report-view"
import { Skeleton } from "@/components/ui/skeleton"
import { getInterview } from "@/lib/interviews"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Interview report" }

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <Report params={params} />
    </Suspense>
  )
}

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const interview = await getInterview(user.id, id)
  if (!interview) notFound()
  if (interview.status !== "completed" || !interview.report) redirect(`/interview/${id}`)
  return <ReportView interview={{ ...interview, report: interview.report }} viewer="candidate" />
}
