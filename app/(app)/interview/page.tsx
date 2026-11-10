import type { Metadata } from "next"
import { Suspense } from "react"
import { InterviewSetup } from "@/components/interview/interview-setup"
import { Skeleton } from "@/components/ui/skeleton"
import { requireRole } from "@/lib/session"
import { isVoiceConfigured } from "@/lib/vapi"

export const metadata: Metadata = { title: "Mock interview" }

export default function InterviewPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-medium">New mock interview</h1>
        <p className="text-muted-foreground">A voice interview with follow-up questions, then a detailed report.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
        <SetupLoader />
      </Suspense>
    </div>
  )
}

async function SetupLoader() {
  const { profile } = await requireRole("student")
  return (
    <InterviewSetup
      targetRole={profile.targetRole}
      hasResume={Boolean(profile.resumeText)}
      voiceAvailable={isVoiceConfigured()}
    />
  )
}
