"use client"

import { CalendarIcon, Loader2Icon, MicIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ApplicationStatus, InterviewType } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

const ROUNDS: { type: InterviewType; label: string }[] = [
  { type: "technical", label: "Technical" },
  { type: "behavioral", label: "Behavioral" },
  { type: "hr", label: "HR" },
]

/** Shortlist / reject / hire, and move back to reviewing. */
export function StatusActions({ id, status }: { id: string; status: ApplicationStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<ApplicationStatus | null>(null)

  async function set(next: ApplicationStatus) {
    if (next === "rejected" && !window.confirm("Mark this candidate as not selected? They'll see the updated status.")) return
    setBusy(next)
    try {
      const res = await fetch(`/api/recruiter/applications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't update.")
      toast.success("Status updated")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update.")
    } finally {
      setBusy(null)
    }
  }

  const spin = (s: ApplicationStatus) => busy === s && <Loader2Icon className="animate-spin" />
  return (
    <div className="flex flex-wrap gap-2">
      {status === "applied" && (
        <Button variant="outline" className="h-9" onClick={() => set("reviewing")} disabled={busy !== null}>
          {spin("reviewing")} Mark as reviewing
        </Button>
      )}
      {status !== "shortlisted" && status !== "hired" && (
        <Button className="h-9" onClick={() => set("shortlisted")} disabled={busy !== null}>
          {spin("shortlisted")} Shortlist
        </Button>
      )}
      {status === "shortlisted" && (
        <Button className="h-9" onClick={() => set("hired")} disabled={busy !== null}>
          {spin("hired")} Mark as hired
        </Button>
      )}
      {status !== "rejected" && status !== "hired" && (
        <Button variant="outline" className="h-9 text-destructive hover:text-destructive" onClick={() => set("rejected")} disabled={busy !== null}>
          {spin("rejected")} Not selected
        </Button>
      )}
      {(status === "rejected" || status === "hired") && (
        <Button variant="ghost" className="h-9" onClick={() => set("reviewing")} disabled={busy !== null}>
          {spin("reviewing")} Reopen
        </Button>
      )}
    </div>
  )
}

/** Private recruiter notes, saved on blur. */
export function RecruiterNotes({ id, initial }: { id: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "")
  const [saved, setSaved] = useState(initial ?? "")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (value === saved) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruiter/applications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recruiterNotes: value }),
      })
      if (!res.ok) throw new Error()
      setSaved(value)
    } catch {
      toast.error("Couldn't save your notes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="notes">Private notes</Label>
        <span className="text-xs text-muted-foreground">{saving ? "Saving…" : value === saved ? "Saved" : "Unsaved"}</span>
      </div>
      <Textarea id="notes" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} placeholder="Only you can see these." className="min-h-28" maxLength={4000} />
    </div>
  )
}

/** Invite the candidate to an AI interview, or schedule a live one. */
export function InviteForm({ applicationId, candidateName }: { applicationId: string; candidateName: string }) {
  const router = useRouter()
  const [kind, setKind] = useState<"ai" | "live">("ai")
  const [type, setType] = useState<InterviewType>("technical")
  const [total, setTotal] = useState(5)
  const [when, setWhen] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    if (kind === "live" && !when) return setError("Pick a date and time.")
    setSending(true)
    try {
      const res = await fetch(`/api/recruiter/applications/${applicationId}/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "ai"
            ? { kind, interviewType: type, totalQuestions: total, message }
            : { kind, scheduledAt: new Date(when).toISOString(), message },
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the invitation.")
      toast.success(`${candidateName} has been invited`)
      setMessage("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the invitation.")
    } finally {
      setSending(false)
    }
  }

  const seg = (active: boolean) =>
    cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-muted p-1" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "ai"} onClick={() => setKind("ai")} className={seg(kind === "ai")}>
          <MicIcon className="size-4" /> AI interview
        </button>
        <button type="button" role="tab" aria-selected={kind === "live"} onClick={() => setKind("live")} className={seg(kind === "live")}>
          <CalendarIcon className="size-4" /> Live interview
        </button>
      </div>

      {kind === "ai" ? (
        <>
          <p className="text-sm text-muted-foreground">
            The candidate does an INT-IQ interview for this job. You get the full report: scores, every answer and the integrity check.
          </p>
          {/* Stacked, not side by side: the invite panel is narrow and "Behavioral" needs the width. */}
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Round</Label>
              {/* Pills at their natural width, wrapping if needed: "Behavioral" never fits a third of this narrow panel. */}
              <div className="flex flex-wrap gap-1.5">
                {ROUNDS.map((r) => (
                  <button key={r.type} type="button" aria-pressed={type === r.type} onClick={() => setType(r.type)} className={cn("rounded-lg border px-3 py-2 text-sm whitespace-nowrap", type === r.type ? "border-brand bg-brand-soft font-medium" : "hover:bg-accent")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Questions</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[3, 5, 7].map((n) => (
                  <button key={n} type="button" aria-pressed={total === n} onClick={() => setTotal(n)} className={cn("rounded-lg border px-2 py-2 text-sm tabular-nums", total === n ? "border-brand bg-brand-soft font-medium" : "hover:bg-accent")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Schedule a private human-to-human video interview. The candidate sees the time and can join their secure INT-IQ room; add any preparation details below.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="when">Date and time</Label>
            <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-10" />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="message">Message to the candidate (optional)</Label>
        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === "ai" ? "e.g. Please complete this within 3 days." : "e.g. Meet link, who they'll talk to, what to prepare."} className="min-h-20" maxLength={1000} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={send} disabled={sending} className="h-10 px-4">
        {sending && <Loader2Icon className="animate-spin" />}
        Send invitation
      </Button>
    </div>
  )
}
