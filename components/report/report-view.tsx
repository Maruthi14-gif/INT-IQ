import { ArrowRightIcon, CameraIcon, CheckIcon, GaugeIcon, LightbulbIcon, MicIcon, TrendingUpIcon } from "lucide-react"
import Link from "next/link"
import { IntegrityCard } from "@/components/report/integrity-card"
import { ScoreRing, scoreTone } from "@/components/report/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Interview, InterviewReport } from "@/lib/db/schema"
import { summarizeIntegrity } from "@/lib/integrity"
import { cn } from "@/lib/utils"

const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const
const DIMENSIONS = [
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "depth", label: "Depth" },
  { key: "relevance", label: "Relevance" },
  { key: "confidence", label: "Confidence" },
] as const

type Props = {
  interview: Interview & { report: InterviewReport }
  /** Candidates get practice links; recruiters get a back link and the candidate's name. */
  viewer: "candidate" | "recruiter"
  candidateName?: string | null
  backHref?: string
}

/** The full interview report. Shared by the candidate's and the recruiter's report pages. */
export function ReportView({ interview, viewer, candidateName, backHref }: Props) {
  const report = interview.report
  const integrity = summarizeIntegrity(interview.integrity)
  const minutes = interview.completedAt
    ? Math.max(1, Math.round((interview.completedAt.getTime() - interview.startedAt.getTime()) / 60_000))
    : null

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{ROUND_LABEL[interview.type]} round</Badge>
            {interview.mode === "voice" && <Badge variant="outline">Voice call</Badge>}
            <span>{interview.targetRole}</span>
            <span aria-hidden>·</span>
            <span>
              {interview.startedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {minutes && (
              <>
                <span aria-hidden>·</span>
                <span>{minutes} min</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{viewer === "recruiter" && candidateName ? `${candidateName}’s interview` : "Interview report"}</h1>
        </div>
        {viewer === "candidate" && (
          <Button asChild className="h-10 px-4">
            <Link href="/interview">
              <MicIcon />
              Practice again
            </Link>
          </Button>
        )}
      </div>

      {/* overall */}
      <section className="grid gap-6 rounded-2xl border bg-card p-6 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreRing score={report.overallScore} className="mx-auto" />
        <div className="space-y-4">
          <div>
            <p className={cn("text-sm font-medium", scoreTone(report.overallScore))}>{report.verdict}</p>
            <p className="mt-1.5 leading-relaxed text-pretty">{report.summary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {DIMENSIONS.map((d) => {
              const value = report.scores[d.key]
              return (
                <div key={d.key}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-mono tabular-nums">{value}/10</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${value * 10}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* anti-cheat (interviews from before the camera checks have no data) */}
      {integrity && <IntegrityCard summary={integrity} mode={interview.mode} />}

      {/* on-device delivery and camera coaching (does not affect the score) */}
      {report.coaching && (
        <section className="rounded-2xl border bg-card p-6" aria-labelledby="coaching-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="coaching-title" className="font-medium">Camera & delivery coaching</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Objective practice signals only. They do not change the interview score, and no video was uploaded.
              </p>
            </div>
            {report.coaching.camera && (
              <span className="text-xs text-muted-foreground">
                {report.coaching.camera.analyzedSeconds}s analyzed · {report.coaching.camera.visiblePercent}% visible
              </span>
            )}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {report.coaching.delivery && (
              <div className="rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <GaugeIcon className="size-4 text-brand-text" /> Delivery
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <Metric value={report.coaching.delivery.wordsPerMinute ?? "—"} label="words/min" />
                  <Metric value={report.coaching.delivery.fillerWords} label="possible fillers" />
                  <Metric value={report.coaching.delivery.longPauses} label="long pauses" />
                </div>
              </div>
            )}
            {report.coaching.camera && (
              <div className="rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <CameraIcon className="size-4 text-brand-text" /> Visual presence
                </h3>
                {report.coaching.camera.issues.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No sustained camera issues were detected.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {report.coaching.camera.issues.slice(0, 5).map((issue) => (
                      <li key={issue.code} className="flex items-center justify-between gap-3">
                        <span>{issue.label}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {issue.seconds}s{issue.reminders > 0 ? ` · ${issue.reminders} cue${issue.reminders === 1 ? "" : "s"}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* strengths / improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 font-medium">
            <CheckIcon className="size-4 text-success" /> What went well
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            {report.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 font-medium">
            <TrendingUpIcon className="size-4 text-warning" /> What to improve
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            {report.improvements.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* per question */}
      <section className="space-y-4" aria-labelledby="answers-title">
        <h2 id="answers-title" className="text-xl font-semibold tracking-tight">
          Answer by answer
        </h2>
        {interview.turns.map((turn, i) => {
          const review = report.answers[i]
          return (
            <article key={i} className="rounded-2xl border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-medium leading-relaxed">
                  <span className="mr-2 text-muted-foreground">Q{i + 1}.</span>
                  {turn.question}
                </h3>
                {review && (
                  <span className={cn("shrink-0 rounded-lg bg-muted px-2 py-1 font-mono text-sm tabular-nums", scoreTone(review.score, 10))}>
                    {review.score}/10
                  </span>
                )}
              </div>
              <blockquote className="mt-3 border-l-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                {turn.answer?.trim() ? turn.answer : <em>No answer given</em>}
              </blockquote>
              {review && (
                <>
                  <p className="mt-4 text-sm leading-relaxed">{review.feedback}</p>
                  {review.betterAnswer && (
                    <div className="mt-4 rounded-xl border bg-brand-soft/60 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-brand-text">
                        <LightbulbIcon className="size-3.5" /> A stronger answer
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed">{review.betterAnswer}</p>
                    </div>
                  )}
                </>
              )}
            </article>
          )
        })}
      </section>

      {/* next steps */}
      {viewer === "candidate" && (
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-medium">Practice next</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.nextSteps.map((s) => (
            <li key={s} className="flex gap-2">
              <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-brand-text" />
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="h-10 px-4">
            <Link href="/interview">Start another interview</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 px-4">
            <Link href="/reports">All reports</Link>
          </Button>
        </div>
      </section>
      )}
      {backHref && (
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href={backHref}>← Back to applicant</Link>
        </Button>
      )}
    </div>
  )
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
