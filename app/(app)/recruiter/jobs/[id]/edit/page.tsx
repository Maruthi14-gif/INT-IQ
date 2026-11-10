import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { JobForm } from "@/components/recruiting/job-form"
import { Skeleton } from "@/components/ui/skeleton"
import { getRecruiterJob } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Edit job" }

type Props = { params: Promise<{ id: string }> }

export default function EditJobPage({ params }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  )
}

async function Editor({ params }: Props) {
  const { id } = await params
  const { user } = await requireRole("recruiter")
  const job = await getRecruiterJob(user.id, id)
  if (!job) notFound()
  return (
    <>
      <div className="space-y-2">
        <Link href={`/recruiter/jobs/${job.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to job
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Edit job</h1>
      </div>
      <JobForm job={job} />
    </>
  )
}
