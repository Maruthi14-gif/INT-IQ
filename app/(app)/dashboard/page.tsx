import {
  CheckIcon,
  ClockIcon,
  GaugeIcon,
  HistoryIcon,
  MicIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { requireUser } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <StartInterviewCard className="lg:col-span-2" />
        <SetupChecklist />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrophyIcon} label="Interviews completed" value="0" />
        <StatCard icon={GaugeIcon} label="Average score" value="—" />
        <StatCard icon={ClockIcon} label="Practice time" value="0 min" />
      </div>

      <RecentInterviews />
    </div>
  )
}

/* ── Greeting (reads the session) ───────────────────────────── */

async function Greeting() {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  const firstName = user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0]

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, <span className="font-display font-normal text-brand-text italic">{firstName}</span>
        </h1>
        <Badge variant="outline" className="capitalize" data-testid="profile-role">
          {profile.role}
        </Badge>
      </div>
      <p className="text-muted-foreground">Let&rsquo;s get you interview-ready.</p>
    </div>
  )
}

function GreetingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-48" />
    </div>
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
            Pick a round and talk it through with your AI interviewer. It takes about 15 minutes.
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

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button disabled className="h-11 bg-white px-5 text-[15px] text-[#0d0c1d] hover:bg-white/90 disabled:opacity-70">
          <MicIcon />
          Start interview
        </Button>
        <span className="text-sm text-white/60">Live voice interviews are coming next.</span>
      </div>
    </section>
  )
}

/* ── Setup checklist ────────────────────────────────────────── */

const SETUP_STEPS = [
  { label: "Create your account", done: true },
  { label: "Upload your resume", done: false },
  { label: "Choose your target role", done: false },
  { label: "Finish your first interview", done: false },
]

function SetupChecklist() {
  const done = SETUP_STEPS.filter((s) => s.done).length
  const pct = Math.round((done / SETUP_STEPS.length) * 100)

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">Get set up</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {done} of {SETUP_STEPS.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-5 space-y-3.5">
        {SETUP_STEPS.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border",
                step.done ? "border-transparent bg-brand text-primary-foreground" : "border-dashed",
              )}
            >
              {step.done && <CheckIcon className="size-3" />}
            </span>
            <span className={cn(step.done && "text-muted-foreground line-through decoration-border")}>{step.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── Stats ──────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">Complete an interview to see this.</p>
    </div>
  )
}

/* ── Recent interviews ──────────────────────────────────────── */

function RecentInterviews() {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="font-medium">Recent interviews</h2>
      </div>
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          <HistoryIcon className="size-5" />
        </span>
        <p className="mt-4 font-medium">No interviews yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your reports will show up here after your first practice round.
        </p>
      </div>
    </section>
  )
}
