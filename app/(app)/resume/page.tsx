import type { Metadata } from "next"
import { Suspense } from "react"
import { ResumeForm } from "@/components/resume/resume-form"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Resume" }

export default function ResumePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Resume & target role</h1>
        <p className="text-muted-foreground">The interviewer uses this to ask about your own projects and skills.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <ResumeLoader />
      </Suspense>
    </div>
  )
}

async function ResumeLoader() {
  const user = await requireUser()
  const p = await getOrCreateProfile(user.id)
  return (
    <ResumeForm
      initial={{
        targetRole: p.targetRole,
        experienceLevel: p.experienceLevel,
        jobDescription: p.jobDescription,
        resumeFileName: p.resumeFileName,
        hasResume: Boolean(p.resumeText),
        resumeInsights: p.resumeInsights,
      }}
    />
  )
}
