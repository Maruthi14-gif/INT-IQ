import { CheckIcon, ClockIcon, GaugeIcon, HistoryIcon, MicIcon, TrophyIcon, type LucideIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { InterviewList } from "@/components/report/interview-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listInterviews, practiceMinutes } from "@/lib/interviews"
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

async function Dashboard() {
  const user = await requireUser()
  const [profile, interviews] = await Promise.all([getOrCreateProfile(user.id), listInterviews(user.id, 20)])
  const firstName = user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0]
  const completed = interviews.filter((i) => i.status === "completed")
  const scored = completed.filter((i) => i.overallScore !== null)
  const average = scored.length ? Math.round(scored.reduce((s, i) => s + (i.overallScore ?? 0), 0) / scored.length) : null
  const best = scored.length ? Math.max(...scored.map((i) => i.overallScore ?? 0)) : null

  const steps = [
    { label: "Create your account", done: true, href: null },
    { label: "Upload your resume", done: Boolean(profile.resumeText), href: "/resume" },
    { label: "Choose your target role", done: Boolean(profile.targetRole), href: "/resume" },
    { label: "Finish your first interview", done: completed.length > 0, href: "/interview" },
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
        <StartInterviewCard className="lg:col-span-2" />
        <SetupChecklist steps={steps} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrophyIcon} label="Interviews completed" value={String(completed.length)} hint={best !== null ? `Best score ${best}` : null} />
        <StatCard icon={GaugeIcon} label="Average score" value={average !== null ? String(average) : "—"} hint={average !== null ? "Out of 100" : null} />
        <StatCard icon={ClockIcon} label="Practice time" value={`${practiceMinutes(interviews)} min`} hint={null} />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-medium">Recent interviews</h2>
          {interviews.length > 0 && (
            <Link href="/reports" className="text-sm font-medium text-brand-text hover:opacity-80">
              View all
            </Link>
          )}
        </div>
        {interviews.length > 0 ? (
          <InterviewList items={interviews.slice(0, 5)} />
        ) : (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
              <HistoryIcon className="size-5" />
            </span>
            <p className="mt-4 font-medium">No interviews yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Your reports will show up here after your first practice round.
            </p>
          </div>
        )}
      </section>
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </>
  )
}

/* ── Start interview ────────────────────────────────────────── */

function StartInterviewCard({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-[#0d0c1d] p-6 text-white ring-1 ring-white/10 sm:p-8",
        className,
      )}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_85%_20%,rgb(99_102_241/0.45),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" />

      <div className="flex items-start justify-between gap-6">
        <div className="max-w-md">
          <Badge className="border-white/15 bg-white/10 text-white/80">Mock interview</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Start a practice interview</h2>
          <p className="mt-2 text-white/70">
            Pick a round and talk it through with your AI interviewer. It takes about 10 minutes.
          </p>
        </div>
        <VoiceOrb className="hidden size-24 shrink-0 sm:grid" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["Technical", "Behavioral", "HR"].map((round) => (
          <span key={round} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
            {round}
          </span>
        ))}
      </div>

      <Button asChild className="mt-8 h-11 bg-white px-5 text-[15px] text-[#0d0c1d] hover:bg-white/90">
        <Link href="/interview">
          <MicIcon />
          Start interview
        </Link>
      </Button>
    </section>
  )
}

/* ── Setup checklist ────────────────────────────────────────── */

function SetupChecklist({ steps }: { steps: { label: string; done: boolean; href: string | null }[] }) {
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">Get set up</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {done} of {steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-5 space-y-3.5">
        {steps.map((step) => {
          const content = (
            <>
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border",
                  step.done ? "border-transparent bg-brand text-primary-foreground" : "border-dashed",
                )}
              >
                {step.done && <CheckIcon className="size-3" />}
              </span>
              <span className={cn(step.done && "text-muted-foreground line-through decoration-border")}>{step.label}</span>
            </>
          )
          return (
            <li key={step.label} className="text-sm">
              {!step.done && step.href ? (
                <Link href={step.href} className="flex items-center gap-3 hover:text-brand-text">
                  {content}
                </Link>
              ) : (
                <span className="flex items-center gap-3">{content}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ── Stats ──────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string | null }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint ?? "Complete an interview to see this."}</p>
    </div>
  )
}
