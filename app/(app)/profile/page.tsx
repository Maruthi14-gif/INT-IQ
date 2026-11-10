import { BriefcaseIcon, FileTextIcon, GraduationCapIcon, UserRoundIcon } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Logo } from "@/components/brand/logo"
import { CometCard } from "@/components/effects/comet-card"
import { GlowingEffect } from "@/components/effects/glowing-effect"
import { Meteors } from "@/components/effects/meteors"
import { MovingBorderLink } from "@/components/effects/moving-border"
import { PageSpotlight } from "@/components/effects/page-spotlight"
import { TextGenerateEffect } from "@/components/effects/text-generate-effect"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Profile" }

const EXPERIENCE = { fresher: "Fresher", junior: "Junior (1–3 yrs)", mid: "Mid level (3+ yrs)" } as const

export default function ProfilePage() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <PageSpotlight />
      <div className="relative space-y-6">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-10 w-52" />
              <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
                <Skeleton className="h-[440px] rounded-2xl" />
                <Skeleton className="h-72 rounded-2xl" />
              </div>
            </>
          }
        >
          <Profile />
        </Suspense>
      </div>
    </div>
  )
}

async function Profile() {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  const name = user.name?.trim() || user.email.split("@")[0]
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  const student = profile.role === "student"
  const since = profile.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })

  return (
    <>
      <header>
        <h1 className="text-3xl font-medium sm:text-4xl">
          <TextGenerateEffect text="Your profile" />
        </h1>
        <p className="mt-1 text-muted-foreground">Your account and interview details</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* The pass: who you are on INT-IQ, at a glance. */}
        <CometCard className="mx-auto w-full max-w-[340px]">
          <div className="relative flex min-h-[440px] flex-col overflow-hidden rounded-2xl bg-stage p-6 text-stage-foreground ring-1 ring-white/10">
            <Meteors number={14} />
            <div aria-hidden className="absolute -top-20 -left-20 size-64 rounded-full bg-brand/20 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <Logo />
              <span className="font-mono text-xs text-white/50">{student ? "Candidate pass" : "Recruiter pass"}</span>
            </div>

            <div className="relative mt-10 grid size-20 place-items-center rounded-2xl bg-brand font-mono text-2xl font-medium text-brand-foreground shadow-[0_14px_36px_-12px_var(--brand)]">
              {initials || <UserRoundIcon className="size-8" />}
            </div>
            <p className="relative mt-6 truncate text-2xl font-medium">{name}</p>
            <p className="relative truncate text-sm text-white/60">{user.email}</p>

            <dl className="relative mt-auto grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-sm">
              <div>
                <dt className="text-white/50">Role</dt>
                <dd className="mt-1 font-medium">{student ? "Student" : "Recruiter"}</dd>
              </div>
              <div>
                <dt className="text-white/50">Member since</dt>
                <dd className="mt-1 font-medium">{since}</dd>
              </div>
              {student && (
                <>
                  <div className="min-w-0">
                    <dt className="text-white/50">Target role</dt>
                    <dd className="mt-1 truncate font-medium">{profile.targetRole ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Experience</dt>
                    <dd className="mt-1 font-medium">{profile.experienceLevel ? EXPERIENCE[profile.experienceLevel] : "Not set"}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </CometCard>

        <div className="space-y-6">
          <section className="relative space-y-4 rounded-2xl border bg-card p-6">
            <GlowingEffect />
            <h2 className="flex items-center gap-2 font-medium">
              <UserRoundIcon className="size-4 text-brand-text" /> Account
            </h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium">{name}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="mt-1 truncate font-medium">{user.email}</dd>
              </div>
            </dl>
          </section>

          <section className="relative space-y-4 rounded-2xl border bg-card p-6">
            <GlowingEffect />
            <div>
              <h2 className="flex items-center gap-2 font-medium">
                {student ? <GraduationCapIcon className="size-4 text-brand-text" /> : <BriefcaseIcon className="size-4 text-brand-text" />}
                {student ? "Student workspace" : "Recruiter workspace"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {student ? "Practice interviews, manage your resume, and track applications." : "Post jobs, review candidates, and run interviews."}
              </p>
            </div>
            {student && (
              <dl className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Target role</dt>
                  <dd className="mt-1 truncate font-medium">{profile.targetRole ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Experience</dt>
                  <dd className="mt-1 font-medium">{profile.experienceLevel ? EXPERIENCE[profile.experienceLevel] : "Not set"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Resume</dt>
                  <dd className="mt-1 truncate font-medium">{profile.resumeText ? (profile.resumeFileName ?? "Added") : "Not added"}</dd>
                </div>
              </dl>
            )}
          </section>

          {student && (
            <section className="relative flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-6">
              <GlowingEffect />
              <div>
                <h2 className="flex items-center gap-2 font-medium">
                  <FileTextIcon className="size-4 text-brand-text" /> Interview profile
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Update your role, experience, job description, or resume analysis.</p>
              </div>
              <MovingBorderLink href="/resume" containerClassName="h-10" className="bg-primary px-4 text-sm text-primary-foreground">
                Edit interview profile
              </MovingBorderLink>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
