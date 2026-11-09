import { ArrowRightIcon, CheckIcon, ClockIcon, FileTextIcon, GaugeIcon, MicIcon, PlayIcon, TrophyIcon, type LucideIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { InterviewList } from "@/components/report/interview-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listInterviews, practiceMinutes, type InterviewSummary } from "@/lib/interviews"
import { getOrCreateProfile } from "@/lib/profiles"
import { requireUser } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  )
}

/** The one thing the student should do next. */
type NextStep =
  | { kind: "resume" }
  | { kind: "first-interview" }
  | { kind: "continue"; interview: InterviewSummary }
  | { kind: "practice"; last: InterviewSummary }

async function Dashboard() {
  const user = await requireUser()
  const [profile, interviews] = await Promise.all([getOrCreateProfile(user.id), listInterviews(user.id, 20)])
  const firstName = user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0]
  const completed = interviews.filter((i) => i.status === "completed")
  const unfinished = interviews.find((i) => i.status === "in_progress")
  const scored = completed.filter((i) => i.overallScore !== null)
  const average = scored.length ? Math.round(scored.reduce((s, i) => s + (i.overallScore ?? 0), 0) / scored.length) : null
  const best = scored.length ? Math.max(...scored.map((i) => i.overallScore ?? 0)) : null
  const hasResume = Boolean(profile.resumeText)

  const next: NextStep = unfinished
    ? { kind: "continue", interview: unfinished }
    : completed.length > 0
      ? { kind: "practice", last: completed[0] }
      : hasResume
        ? { kind: "first-interview" }
        : { kind: "resume" }

  const steps = [
    { label: "Add your resume", hint: "So questions are about your projects", done: hasResume, href: "/resume" },
    { label: "Do a mock interview", hint: "Voice call or text, about 10 minutes", done: completed.length > 0, href: "/interview" },
    { label: "Read your report", hint: "Score, feedback, better answers", done: completed.length > 0, href: completed[0] ? `/reports/${completed[0].id}` : null },
  ]

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome, <span className="font-display font-normal text-brand-text italic">{firstName}</span>
          </h1>
          <Badge variant="outline" className="capitalize" data-testid="profile-role">
            {profile.role}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {profile.targetRole ? `Preparing for ${profile.targetRole}.` : "Let’s get you interview-ready."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <NextStepCard next={next} className="lg:col-span-2" />
        <HowItWorks steps={steps} />
      </div>

      {/* Stats and history only once there's something to show. */}
      {interviews.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={TrophyIcon} label="Interviews completed" value={String(completed.length)} hint={best !== null ? `Best score ${best}` : "Finish one to see scores"} />
            <StatCard icon={GaugeIcon} label="Average score" value={average !== null ? String(average) : "—"} hint={average !== null ? "Out of 100" : "Finish one to see scores"} />
            <StatCard icon={ClockIcon} label="Practice time" value={`${practiceMinutes(interviews)} min`} hint="Time spent in interviews" />
          </div>

          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-medium">Recent interviews</h2>
              <Link href="/reports" className="text-sm font-medium text-brand-text hover:opacity-80">
                View all
              </Link>
            </div>
            <InterviewList items={interviews.slice(0, 5)} />
          </section>
        </>
      )}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </>
  )
}

/* ── Next step ──────────────────────────────────────────────── */

function NextStepCard({ next, className }: { next: NextStep; className?: string }) {
  const content = {
    resume: {
      eyebrow: "Step 1 of 3",
      title: "Add your resume",
      body: "Upload your resume and pick the role you want. The interviewer will then ask about your own projects and skills. It takes about a minute.",
      primary: { href: "/resume", label: "Add my resume", icon: FileTextIcon },
      secondary: { href: "/interview", label: "Skip for now and start an interview" },
    },
    "first-interview": {
      eyebrow: "Step 2 of 3",
      title: "Do your first mock interview",
      body: "Talk to the AI interviewer for about 10 minutes. It asks follow-up questions based on your answers, then gives you a detailed report.",
      primary: { href: "/interview", label: "Start interview", icon: MicIcon },
      secondary: { href: "/resume", label: "Review my resume first" },
    },
    continue: {
      eyebrow: "Unfinished interview",
      title: "Pick up where you left off",
      body: "Your answers so far are saved. Continue the interview to get your report.",
      primary: { href: next.kind === "continue" ? `/interview/${next.interview.id}` : "/interview", label: "Continue interview", icon: PlayIcon },
      secondary: { href: "/interview", label: "Start a new one instead" },
    },
    practice: {
      eyebrow: "Keep practicing",
      title: next.kind === "practice" && next.last.overallScore !== null ? `Last score: ${next.last.overallScore}. Ready to beat it?` : "Ready for another round?",
      body: "Each round asks new questions. Try a different round type to cover technical, behavioral and HR.",
      primary: { href: "/interview", label: "Start interview", icon: MicIcon },
      secondary: next.kind === "practice" ? { href: `/reports/${next.last.id}`, label: "See my last report" } : null,
    },
  }[next.kind]

  const PrimaryIcon = content.primary.icon

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-[#0d0c1d] p-6 text-white ring-1 ring-white/10 sm:p-8",
        className,
      )}
      aria-labelledby="next-step-title"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_85%_20%,rgb(99_102_241/0.45),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" />

      <div className="flex items-start justify-between gap-6">
        <div className="max-w-md">
          <Badge className="border-white/15 bg-white/10 text-white/80">{content.eyebrow}</Badge>
          <h2 id="next-step-title" className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {content.title}
          </h2>
          <p className="mt-2 text-white/70">{content.body}</p>
        </div>
        <VoiceOrb className="hidden size-24 shrink-0 sm:grid" />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button asChild className="h-11 bg-white px-5 text-[15px] text-[#0d0c1d] hover:bg-white/90">
          <Link href={content.primary.href}>
            <PrimaryIcon />
            {content.primary.label}
          </Link>
        </Button>
        {content.secondary && (
          <Link href={content.secondary.href} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
            {content.secondary.label}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        )}
      </div>
    </section>
  )
}

/* ── How it works ───────────────────────────────────────────── */

function HowItWorks({ steps }: { steps: { label: string; hint: string; done: boolean; href: string | null }[] }) {
  const current = steps.findIndex((s) => !s.done)

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6" aria-labelledby="how-title">
      <h2 id="how-title" className="font-medium">
        How INT-IQ works
      </h2>
      <ol className="mt-5 space-y-5">
        {steps.map((step, i) => {
          const isCurrent = i === current
          const body = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  step.done && "border-transparent bg-brand text-primary-foreground",
                  isCurrent && "border-brand text-brand-text ring-3 ring-brand/20",
                  !step.done && !isCurrent && "text-muted-foreground",
                )}
              >
                {step.done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span>
                <span className={cn("block text-sm font-medium", step.done && "text-muted-foreground")}>
                  {step.label}
                  {isCurrent && <span className="ml-2 text-xs font-normal text-brand-text">← you are here</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{step.hint}</span>
              </span>
            </>
          )
          return (
            <li key={step.label}>
              {step.href && !step.done ? (
                <Link href={step.href} className="flex gap-3 rounded-lg hover:text-brand-text">
                  {body}
                </Link>
              ) : (
                <span className="flex gap-3">{body}</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ── Stats ──────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
