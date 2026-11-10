import { CalendarIcon, ChevronRightIcon, FileTextIcon, MicIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { scoreTone } from "@/components/report/score-ring"
import { InviteForm, RecruiterNotes, StatusActions } from "@/components/recruiting/applicant-actions"
import { ApplicationStatusBadge, InvitationStatusBadge, LEVEL_LABEL } from "@/components/recruiting/status-badge"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getApplicationForRecruiter } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Applicant" }

type Props = { params: Promise<{ id: string }> }
const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const

export default function ApplicationPage({ params }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-96 rounded-2xl" />
          </>
        }
      >
        <Applicant params={params} />
      </Suspense>
    </div>
  )
}

async function Applicant({ params }: Props) {
  const { id } = await params
  const { user } = await requireRole("recruiter")
  const data = await getApplicationForRecruiter(user.id, id)
  if (!data) notFound()
  const { application, job, candidate, profile, invitations, interviews } = data
  const name = candidate.name?.trim() || candidate.email
  const insights = profile?.resumeInsights

  return (
    <>
      <div className="space-y-2">
        <Link href={`/recruiter/jobs/${job.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {job.title}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <ApplicationStatusBadge status={application.status} />
        </div>
        <p className="text-muted-foreground">
          {candidate.email} · applied {application.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* status */}
          <section className="space-y-3 rounded-2xl border bg-card p-6">
            <h2 className="font-medium">Decision</h2>
            <StatusActions id={application.id} status={application.status} />
            <RecruiterNotes id={application.id} initial={application.recruiterNotes} />
          </section>

          {/* interviews */}
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-6 py-4">
              <h2 className="font-medium">Interviews</h2>
            </div>
            {invitations.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No interviews yet. Invite {name.split(" ")[0]} using the panel on the right.</p>
            ) : (
              <ul className="divide-y">
                {invitations.map((inv) => {
                  const interview = interviews.find((i) => i.id === inv.interviewId)
                  const done = interview?.status === "completed"
                  const row = (
                    <>
                      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl bg-muted font-mono text-sm font-medium tabular-nums", done && interview.overallScore !== null ? scoreTone(interview.overallScore) : "text-muted-foreground")}>
                        {done && interview.overallScore !== null ? interview.overallScore : inv.kind === "live" ? <CalendarIcon className="size-4" /> : <MicIcon className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {inv.kind === "ai" ? `AI interview · ${inv.interviewType ? ROUND_LABEL[inv.interviewType] : ""} · ${inv.totalQuestions} questions` : "Live interview"}
                          </span>
                          <InvitationStatusBadge status={inv.status} />
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {inv.kind === "live" && inv.scheduledAt
                            ? inv.scheduledAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                            : done
                              ? "Report ready · tap to read"
                              : inv.status === "accepted"
                                ? "Candidate has started"
                                : `Invited ${inv.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        </span>
                      </span>
                      {done && <ChevronRightIcon className="size-4 text-muted-foreground" />}
                    </>
                  )
                  return (
                    <li key={inv.id}>
                      {done ? (
                        <Link href={`/recruiter/reports/${interview.id}`} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/40">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-4 px-6 py-4">{row}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* profile */}
          <section className="rounded-2xl border bg-card p-6" aria-labelledby="profile-title">
            <h2 id="profile-title" className="flex items-center gap-2 font-medium">
              <FileTextIcon className="size-4 text-muted-foreground" /> Profile and resume
            </h2>
            {profile ? (
              <div className="mt-4 space-y-5">
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Target role</dt>
                    <dd className="font-medium">{profile.targetRole ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Experience</dt>
                    <dd className="font-medium">{profile.experienceLevel ? LEVEL_LABEL[profile.experienceLevel] : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Resume</dt>
                    <dd className="font-medium">{profile.resumeText ? (profile.resumeFileName ?? "Pasted text") : "Not added"}</dd>
                  </div>
                </dl>
                {application.coverNote && (
                  <div>
                    <h3 className="text-sm text-muted-foreground">Note from the candidate</h3>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{application.coverNote}</p>
                  </div>
                )}
                {insights && (
                  <>
                    <p className="text-sm leading-relaxed">{insights.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {insights.skills.map((s) => (
                        <Badge key={s} variant={job.skills.some((k) => k.toLowerCase() === s.toLowerCase()) ? "default" : "secondary"}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                    {insights.projects.length > 0 && (
                      <ul className="space-y-2">
                        {insights.projects.map((p) => (
                          <li key={p.name} className="rounded-xl border px-3 py-2 text-sm">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground"> — {p.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">Highlighted skills match this job. Summary and skills were extracted by AI from the candidate&rsquo;s resume.</p>
                  </>
                )}
                {profile.resumeText && (
                  <details className="rounded-xl border">
                    <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Full resume text</summary>
                    <pre className="max-h-96 overflow-auto px-4 pb-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{profile.resumeText}</pre>
                  </details>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">The candidate hasn&rsquo;t set up a profile yet.</p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-6 lg:sticky lg:top-20">
          <h2 className="font-medium">Invite to interview</h2>
          <div className="mt-4">
            <InviteForm applicationId={application.id} candidateName={name.split(" ")[0]} />
          </div>
        </aside>
      </div>
    </>
  )
}
