import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { JobList } from "@/components/recruiting/job-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listRecruiterJobs, recruiterStats } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Recruiter dashboard" }

export default function RecruiterDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  )
}

async function Dashboard() {
  const { user } = await requireRole("recruiter")
  const [stats, jobs] = await Promise.all([recruiterStats(user.id), listRecruiterJobs(user.id)])

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-medium">Hiring overview</h1>
          <p className="text-muted-foreground">{jobs.length === 0 ? "Post your first job to start receiving applicants" : "Counts update as candidates apply and finish interviews"}</p>
        </div>
        <Button asChild className="h-10 px-4">
          <Link href="/recruiter/jobs/new">
            <PlusIcon />
            New job
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active jobs" value={stats.activeJobs} />
        <Stat label="Total applicants" value={stats.applicants} />
        <Stat label="Pending review" value={stats.pending} />
        <Stat label="Interviews scheduled" value={stats.scheduled} />
        <Stat label="Interviews completed" value={stats.completed} />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-medium">Your jobs</h2>
          <Link href="/recruiter/jobs" className="text-sm font-medium text-brand-text hover:opacity-80">
            View all
          </Link>
        </div>
        <JobList jobs={jobs.slice(0, 5)} />
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 font-mono text-3xl font-medium tabular-nums">{value}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </>
  )
}
