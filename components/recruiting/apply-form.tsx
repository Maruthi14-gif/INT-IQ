"use client"

import { Loader2Icon, SendIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/** Candidate applies to a job with an optional note. */
export function ApplyForm({ jobId, hasResume }: { jobId: string; hasResume: boolean }) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coverNote: note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't apply. Please try again.")
      toast.success("Application sent")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply. Please try again.")
      setSending(false)
    }
  }

  if (!hasResume) {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-6">
        <h2 className="font-medium">Apply for this job</h2>
        <p className="text-sm text-muted-foreground">Recruiters see your resume and target role, so add them first. It takes about a minute.</p>
        <Button asChild className="h-10 px-4">
          <Link href="/resume">Add my resume</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      <h2 className="font-medium">Apply for this job</h2>
      <p className="text-sm text-muted-foreground">The recruiter gets your resume, target role and the note below.</p>
      <div className="space-y-1.5">
        <Label htmlFor="note">A short note (optional)</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you're a good fit, in a few lines." className="min-h-24" maxLength={1500} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={apply} disabled={sending} className="h-11 px-5 text-[15px]">
        {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        Apply now
      </Button>
    </div>
  )
}
