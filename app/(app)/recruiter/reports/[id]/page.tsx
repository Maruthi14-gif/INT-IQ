import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ReportView } from "@/components/report/report-view"
import { Skeleton } from "@/components/ui/skeleton"
import { getInterviewForRecruiter } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Candidate report" }

type Props = { params: Promise<{ id: string }> }

/** A recruiter reading the report of an AI interview they invited the candidate to. */
export default function RecruiterReportPage({ params }: Props) {
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

async function Report({ params }: Props) {
  const { id } = await params
  const { user } = await requireRole("recruiter")
  const row = await getInterviewForRecruiter(user.id, id)
  if (!row || row.interview.status !== "completed" || !row.interview.report) notFound()
  return (
    <ReportView
      interview={{ ...row.interview, report: row.interview.report }}
      viewer="recruiter"
      candidateName={row.candidate.name?.trim() || row.candidate.email}
      backHref={`/recruiter/applications/${row.interview.applicationId}`}
    />
  )
}
