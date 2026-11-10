import type { Metadata } from "next"
import { Suspense } from "react"
import { JobForm } from "@/components/recruiting/job-form"
import { requireRole } from "@/lib/session"

export const metadata: Metadata = { title: "New job" }

export default function NewJobPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">New job</h1>
        <p className="text-muted-foreground">Describe the role. Candidates see the title, company, skills and description.</p>
      </div>
      <Suspense fallback={null}>
        <Guard />
      </Suspense>
      <JobForm />
    </div>
  )
}

/** Only recruiters can be here; the form itself is static so it renders instantly. */
async function Guard() {
  await requireRole("recruiter")
  return null
}
