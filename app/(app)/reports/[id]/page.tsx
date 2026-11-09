import { ArrowRightIcon, CheckIcon, LightbulbIcon, MicIcon, TrendingUpIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { IntegrityCard } from "@/components/report/integrity-card"
import { ScoreRing, scoreTone } from "@/components/report/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { summarizeIntegrity } from "@/lib/integrity"
import { getInterview } from "@/lib/interviews"
import { requireUser } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Interview report" }

const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const
const DIMENSIONS = [
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "depth", label: "Depth" },
  { key: "relevance", label: "Relevance" },
  { key: "confidence", label: "Confidence" },
] as const

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
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

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const interview = await getInterview(user.id, id)
  if (!interview) notFound()
  if (interview.status !== "completed" || !interview.report) redirect(`/interview/${id}`)

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
          <h1 className="text-3xl font-semibold tracking-tight">Interview report</h1>
        </div>
        <Button asChild className="h-10 px-4">
          <Link href="/interview">
            <MicIcon />
            Practice again
          </Link>
        </Button>
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
    </div>
  )
}
