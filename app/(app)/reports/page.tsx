import { HistoryIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { InterviewList } from "@/components/report/interview-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listInterviews } from "@/lib/interviews"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Every practice interview, with scores and feedback.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
        <Reports />
      </Suspense>
    </div>
  )
}

async function Reports() {
  const user = await requireUser()
  const items = await listInterviews(user.id)
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          <HistoryIcon className="size-5" />
        </span>
        <p className="mt-4 font-medium">No interviews yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Your reports will show up here after your first practice round.</p>
        <Button asChild className="mt-5 h-10 px-4">
          <Link href="/interview">Start an interview</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <InterviewList items={items} />
    </div>
  )
}
