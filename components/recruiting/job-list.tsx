import { BriefcaseIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { HighlightList } from "@/components/effects/highlight-list"
import { JobStatusBadge } from "@/components/recruiting/status-badge"
import { Button } from "@/components/ui/button"
import type { RecruiterJobSummary } from "@/lib/recruiting"

/** Recruiter's jobs with applicant counts. */
export function JobList({ jobs }: { jobs: RecruiterJobSummary[] }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          <BriefcaseIcon className="size-5" />
        </span>
        <p className="mt-4 font-medium">No jobs yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Create a job, publish it, and candidates on INT-IQ can apply.</p>
        <Button asChild className="mt-5 h-10 px-4">
          <Link href="/recruiter/jobs/new">Create a job</Link>
        </Button>
      </div>
    )
  }
  return (
    <HighlightList className="divide-y">
      {jobs.map((job) => (
        <li key={job.id} data-row>
          <Link href={`/recruiter/jobs/${job.id}`} className="mx-2 flex items-center gap-4 rounded-xl px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{job.title}</span>
                <JobStatusBadge status={job.status} />
              </span>
              <span className="block text-sm text-muted-foreground">
                {job.company}
                {job.location && ` · ${job.location}`} · {job.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {job.applicants} applicant{job.applicants === 1 ? "" : "s"}
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </HighlightList>
  )
}
