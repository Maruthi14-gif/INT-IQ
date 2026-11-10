import { BriefcaseIcon, CalendarIcon, MicIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ApplicationStatusBadge, InvitationStatusBadge } from "@/components/recruiting/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listMyApplications } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "My applications" }

const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const

export default function ApplicationsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-medium">My applications</h1>
        <p className="text-muted-foreground">Where each application stands, and interviews recruiters have invited you to.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Applications />
      </Suspense>
    </div>
  )
}

async function Applications() {
  const { user } = await requireRole("student")
  const apps = await listMyApplications(user.id)
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          <BriefcaseIcon className="size-5" />
        </span>
        <p className="mt-4 font-medium">No applications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Browse open jobs and apply with your resume.</p>
        <Button asChild className="mt-5 h-10 px-4">
          <Link href="/jobs">Find jobs</Link>
        </Button>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {apps.map((app) => (
        <li key={app.id} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <div className="min-w-0 flex-1">
              <Link href={`/jobs/${app.job.id}`} className="font-medium hover:underline">
                {app.job.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {app.job.company}
                {app.job.location && ` · ${app.job.location}`} · applied {app.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
            <ApplicationStatusBadge status={app.status} />
          </div>

          {app.invitations.length > 0 && (
            <ul className="divide-y border-t bg-muted/30">
              {app.invitations.map((inv) => {
                const actionable = inv.kind === "ai" && inv.status !== "completed" && inv.status !== "declined"
                return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground">
                      {inv.kind === "ai" ? <MicIcon className="size-4" /> : <CalendarIcon className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {inv.kind === "ai"
                            ? `AI interview · ${inv.interviewType ? ROUND_LABEL[inv.interviewType] : ""} · ${inv.totalQuestions} questions`
                            : "Live interview with the recruiter"}
                        </span>
                        <InvitationStatusBadge status={inv.status} />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {inv.kind === "live" && inv.scheduledAt
                          ? inv.scheduledAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                          : inv.status === "completed"
                            ? "Done. The recruiter has your report."
                            : inv.status === "accepted"
                              ? "You've started this interview."
                              : "Take it when you're ready. The recruiter sees your report."}
                      </span>
                      {inv.message && <span className="mt-1 block text-sm text-muted-foreground">&ldquo;{inv.message}&rdquo;</span>}
                    </span>
                    {actionable && (
                      <Button asChild className="h-9">
                        <Link href={`/invitations/${inv.id}`}>{inv.status === "accepted" ? "Continue" : "Start interview"}</Link>
                      </Button>
                    )}
                    {inv.kind === "ai" && inv.status === "completed" && inv.interviewId && (
                      <Button asChild variant="outline" className="h-9">
                        <Link href={`/reports/${inv.interviewId}`}>My report</Link>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
