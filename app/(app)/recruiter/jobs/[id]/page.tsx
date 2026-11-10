import { ChevronRightIcon, MapPinIcon, PencilIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { JobActions } from "@/components/recruiting/job-actions"
import { ApplicationStatusBadge, JobStatusBadge, LEVEL_LABEL } from "@/components/recruiting/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getRecruiterJob, listApplicants } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Job" }

type Props = { params: Promise<{ id: string }> }

export default function JobPage({ params }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </>
        }
      >
        <JobDetail params={params} />
      </Suspense>
    </div>
  )
}

async function JobDetail({ params }: Props) {
  const { id } = await params
  const { user } = await requireRole("recruiter")
  const job = await getRecruiterJob(user.id, id)
  if (!job) notFound()
  const applicants = await listApplicants(user.id, id)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/recruiter/jobs" className="text-sm text-muted-foreground hover:text-foreground">
            ← All jobs
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-medium">{job.title}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span>{job.company}</span>
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {job.location}
              </span>
            )}
            <span>{LEVEL_LABEL[job.experienceLevel]}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10 px-4">
            <Link href={`/recruiter/jobs/${job.id}/edit`}>
              <PencilIcon />
              Edit
            </Link>
          </Button>
          <JobActions id={job.id} status={job.status} />
        </div>
      </div>

      {job.status === "draft" && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          This job is a draft. Publish it so candidates can find it and apply.
        </p>
      )}

      <section className="grid gap-4 rounded-2xl border bg-card p-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Description</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>
          {job.responsibilities && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Responsibilities</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{job.responsibilities}</p>
            </div>
          )}
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Required skills</h2>
          {job.skills.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">None listed</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="applicants-title">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="applicants-title" className="flex items-center gap-2 font-medium">
            <UsersIcon className="size-4 text-muted-foreground" />
            Applicants
            <span className="text-sm font-normal text-muted-foreground">({applicants.length})</span>
          </h2>
        </div>
        {applicants.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {job.status === "open" ? "No applicants yet. Share the job with candidates." : "Publish the job to receive applicants."}
          </p>
        ) : (
          <ul className="divide-y">
            {applicants.map((a) => (
              <li key={a.id}>
                <Link href={`/recruiter/applications/${a.id}`} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium text-foreground">
                    {(a.name?.trim() || a.email)[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{a.name?.trim() || a.email}</span>
                      <ApplicationStatusBadge status={a.status} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {a.targetRole ?? "No target role"}
                      {a.experienceLevel && ` · ${LEVEL_LABEL[a.experienceLevel]}`}
                      {!a.hasResume && " · No resume"} · applied {a.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {a.invitations > 0 && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {a.invitations} interview{a.invitations === 1 ? "" : "s"}
                    </span>
                  )}
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
