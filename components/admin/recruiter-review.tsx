"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { RecruiterStatus } from "@/lib/db/schema"

/** Approve or decline one recruiter. Declining needs a reason the recruiter will see. */
export function RecruiterReview({ userId, name, status }: { userId: string; name: string; status: RecruiterStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null)
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState("")

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision)
    try {
      const res = await fetch(`/api/admin/recruiters/${userId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decision === "approved" ? { decision } : { decision, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the decision.")
      toast.success(decision === "approved" ? `${name} is approved` : `${name} was declined`)
      setDeclining(false)
      setNote("")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the decision.")
    } finally {
      setBusy(null)
    }
  }

  if (declining) {
    const id = `decline-${userId}`
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>Reason the recruiter will see</Label>
        <Textarea id={id} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="We couldn't confirm you work at this company." />
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" className="h-9" onClick={() => decide("rejected")} disabled={busy !== null || note.trim().length < 3}>
            {busy === "rejected" && <Loader2Icon className="animate-spin" />}
            {status === "approved" ? "Revoke approval" : "Decline"}
          </Button>
          <Button variant="ghost" className="h-9" onClick={() => setDeclining(false)} disabled={busy !== null}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button className="h-9" onClick={() => decide("approved")} disabled={busy !== null}>
          {busy === "approved" && <Loader2Icon className="animate-spin" />}
          Approve
        </Button>
      )}
      <Button variant="outline" className="h-9" onClick={() => setDeclining(true)} disabled={busy !== null}>
        {status === "approved" ? "Revoke approval" : status === "rejected" ? "Change reason" : "Decline"}
      </Button>
    </div>
  )
}
