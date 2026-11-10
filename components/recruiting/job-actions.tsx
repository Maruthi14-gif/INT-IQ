"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { JobStatus } from "@/lib/db/schema"

/** Publish / close / reopen a job. */
export function JobActions({ id, status }: { id: string; status: JobStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<JobStatus | null>(null)

  async function setStatus(next: JobStatus) {
    if (next === "closed" && !window.confirm("Close this job? Candidates won't be able to apply anymore. You can reopen it later.")) return
    setBusy(next)
    try {
      const res = await fetch(`/api/recruiter/jobs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the job.")
      toast.success(next === "open" ? "Job published. Candidates can apply now." : next === "closed" ? "Job closed." : "Job moved to drafts.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the job.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "open" && (
        <Button onClick={() => setStatus("open")} disabled={busy !== null} className="h-10 px-4">
          {busy === "open" && <Loader2Icon className="animate-spin" />}
          {status === "closed" ? "Reopen job" : "Publish job"}
        </Button>
      )}
      {status === "open" && (
        <Button variant="outline" onClick={() => setStatus("closed")} disabled={busy !== null} className="h-10 px-4">
          {busy === "closed" && <Loader2Icon className="animate-spin" />}
          Close job
        </Button>
      )}
    </div>
  )
}
