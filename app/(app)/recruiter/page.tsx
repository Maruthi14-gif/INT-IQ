import { BadgeCheckIcon, PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { CountUp } from "@/components/effects/count-up"
import { GlowingEffect } from "@/components/effects/glowing-effect"
import { HoverBorderGradientLink } from "@/components/effects/hover-border-gradient"
import { PageSpotlight } from "@/components/effects/page-spotlight"
import { TextGenerateEffect } from "@/components/effects/text-generate-effect"
import { JobList } from "@/components/recruiting/job-list"
import { RecruiterVerification } from "@/components/recruiting/recruiter-verification"
import { Skeleton } from "@/components/ui/skeleton"
import { assessRecruiter } from "@/lib/recruiter-assessment"
import { getRecruiterWithCompany } from "@/lib/recruiters"
import { listRecruiterJobs, recruiterStats } from "@/lib/recruiting"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "Recruiter dashboard" }

export default function RecruiterDashboardPage() {
  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <PageSpotlight />
      <div className="relative space-y-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </div>
  )
}

async function Dashboard() {
  const { user } = await requireRole("recruiter")
  const [stats, jobs, { recruiter, company }] = await Promise.all([recruiterStats(user.id), listRecruiterJobs(user.id), getRecruiterWithCompany(user.id)])
  const assessment = company?.check ? assessRecruiter(company.check, recruiter.emailCheck) : null

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-medium sm:text-4xl">
            <TextGenerateEffect text="Hiring overview" />
          </h1>
          {recruiter.status === "approved" && company && (
            <p className="flex items-center gap-1.5 text-sm" data-testid="hiring-for">
              <BadgeCheckIcon className="size-4 text-success" aria-hidden />
              Hiring for <span className="font-medium">{company.name}</span>
              <span className="text-muted-foreground">· {company.domain}</span>
            </p>
          )}
          <p className="text-muted-foreground">{jobs.length === 0 ? "Post your first job to start receiving applicants" : "Counts update as candidates apply and finish interviews"}</p>
        </div>
        <HoverBorderGradientLink href="/recruiter/jobs/new" className="h-10 px-4">
          <PlusIcon className="size-4" />
          New job
        </HoverBorderGradientLink>
      </div>

      {recruiter.status !== "approved" && (
        <RecruiterVerification
          status={recruiter.status}
          submitted={Boolean(recruiter.submittedAt)}
          reviewNote={recruiter.reviewNote}
          assessment={assessment}
          company={{
            name: company?.name ?? recruiter.companyName,
            website: company?.website ?? recruiter.companyWebsite,
            industry: company?.industry ?? null,
            size: company?.size ?? null,
            headquarters: company?.headquarters ?? null,
            linkedinUrl: company?.linkedinUrl ?? null,
            gstin: company?.gstin ?? null,
            about: company?.about ?? null,
          }}
          recruiter={{ jobTitle: recruiter.jobTitle, linkedinUrl: recruiter.linkedinUrl, note: recruiter.note }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active jobs" value={stats.activeJobs} />
        <Stat label="Total applicants" value={stats.applicants} />
        <Stat label="Pending review" value={stats.pending} />
        <Stat label="Interviews scheduled" value={stats.scheduled} />
        <Stat label="Interviews completed" value={stats.completed} />
      </div>

      <section className="relative rounded-2xl border bg-card">
        <GlowingEffect />
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-medium">Your jobs</h2>
          <Link href="/recruiter/jobs" className="text-sm font-medium text-brand-text hover:opacity-80">
            View all
          </Link>
        </div>
        <div className="py-2">
          <JobList jobs={jobs.slice(0, 5)} />
        </div>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative rounded-2xl border bg-card p-5">
      <GlowingEffect />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 font-mono text-3xl font-medium tabular-nums">
        <CountUp value={value} />
      </p>
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
