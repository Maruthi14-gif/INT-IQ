import { CheckCircle2Icon, MapPinIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ApplyForm } from "@/components/recruiting/apply-form"
import { ApplicationStatusBadge, LEVEL_LABEL } from "@/components/recruiting/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getOpenJob } from "@/lib/recruiting"
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
            <Skeleton className="h-96 rounded-2xl" />
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
  const { user, profile } = await requireRole("student")
  const row = await getOpenJob(user.id, id)
  if (!row) notFound()
  const { job, applicationId, applicationStatus } = row
  const mySkills = new Set((profile.resumeInsights?.skills ?? []).map((s) => s.toLowerCase()))

  return (
    <>
      <div className="space-y-2">
        <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← All jobs
        </Link>
        <h1 className="text-3xl font-medium">{job.title}</h1>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5 rounded-2xl border bg-card p-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">About the role</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>
          {job.responsibilities && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Responsibilities</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{job.responsibilities}</p>
            </div>
          )}
          {job.skills.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Skills</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <Badge key={s} variant={mySkills.has(s.toLowerCase()) ? "default" : "secondary"}>
                    {s}
                  </Badge>
                ))}
              </div>
              {mySkills.size > 0 && <p className="mt-2 text-xs text-muted-foreground">Highlighted skills are on your resume.</p>}
            </div>
          )}
        </section>

        <div className="space-y-4">
          {applicationId && applicationStatus ? (
            <div className="space-y-3 rounded-2xl border bg-card p-6">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2Icon className="size-4 text-success" /> You&rsquo;ve applied
              </p>
              <ApplicationStatusBadge status={applicationStatus} />
              <p className="text-sm text-muted-foreground">The recruiter will invite you to an interview from here if they&rsquo;d like to go ahead.</p>
              <Button asChild variant="outline" className="h-10 w-full">
                <Link href="/applications">My applications</Link>
              </Button>
            </div>
          ) : (
            <ApplyForm jobId={job.id} hasResume={Boolean(profile.resumeText)} />
          )}
          <div className="rounded-2xl border bg-card p-5 text-sm">
            <p className="font-medium">Want to warm up first?</p>
            <p className="mt-1 text-muted-foreground">Do a mock interview for this kind of role before the real one.</p>
            <Button asChild variant="outline" className="mt-3 h-9">
              <Link href="/interview">Practice interview</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
