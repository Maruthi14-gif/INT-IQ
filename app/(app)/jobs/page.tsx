import { BriefcaseIcon, ChevronRightIcon, MapPinIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ApplicationStatusBadge, LEVEL_LABEL } from "@/components/recruiting/status-badge"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { listOpenJobs } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Find jobs" }

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-medium">Find jobs</h1>
        <p className="text-muted-foreground">Open roles from recruiters on INT-IQ. Apply with your resume, then interview from here.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Jobs />
      </Suspense>
    </div>
  )
}

async function Jobs() {
  const { user } = await requireRole("student")
  const jobs = await listOpenJobs(user.id)
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          <BriefcaseIcon className="size-5" />
        </span>
        <p className="mt-4 font-medium">No open jobs right now</p>
        <p className="mt-1 text-sm text-muted-foreground">Check back soon. Meanwhile, keep practicing.</p>
      </div>
    )
  }
  return (
    <ul className="grid gap-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/jobs/${job.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:bg-accent/40">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{job.title}</span>
                {job.applicationStatus && <ApplicationStatusBadge status={job.applicationStatus} />}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{job.company}</span>
                {job.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" />
                    {job.location}
                  </span>
                )}
                <span>{LEVEL_LABEL[job.experienceLevel]}</span>
              </span>
              {job.skills.length > 0 && (
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {job.skills.slice(0, 6).map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                  {job.skills.length > 6 && <span className="text-xs text-muted-foreground">+{job.skills.length - 6}</span>}
                </span>
              )}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
