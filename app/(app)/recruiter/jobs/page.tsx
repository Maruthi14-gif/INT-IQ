import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { JobList } from "@/components/recruiting/job-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listRecruiterJobs } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Jobs" }

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">Drafts are private. Open jobs are visible to every candidate on INT-IQ.</p>
        </div>
        <Button asChild className="h-10 px-4">
          <Link href="/recruiter/jobs/new">
            <PlusIcon />
            New job
          </Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Jobs />
      </Suspense>
    </div>
  )
}

async function Jobs() {
  const { user } = await requireRole("recruiter")
  const jobs = await listRecruiterJobs(user.id)
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <JobList jobs={jobs} />
    </div>
  )
}
