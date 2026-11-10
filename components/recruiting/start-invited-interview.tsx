"use client"

import { KeyboardIcon, Loader2Icon, PhoneCallIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { InterviewMode } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

/** Picks voice or text and starts the interview the recruiter set up. */
export function StartInvitedInterview({ invitationId, voiceAvailable }: { invitationId: string; voiceAvailable: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<InterviewMode>(voiceAvailable ? "voice" : "text")
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setStarting(true)
    setError(null)
    try {
      // Round and length come from the invitation; the server ignores these two.
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "technical", totalQuestions: 5, mode, invitationId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the interview.")
      router.push(`/interview/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the interview.")
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { mode: "voice" as const, title: "Voice call", body: "Talk naturally, like a phone call.", icon: PhoneCallIcon, disabled: !voiceAvailable },
          { mode: "text" as const, title: "Text & mic", body: "Read each question, type or dictate.", icon: KeyboardIcon, disabled: false },
        ].map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            disabled={m.disabled}
            onClick={() => setMode(m.mode)}
            className={cn("flex gap-3 rounded-xl border bg-card p-4 text-left transition-colors disabled:opacity-60", mode === m.mode ? "border-brand ring-3 ring-brand/20" : "hover:bg-accent/50")}
          >
            <m.icon className="mt-0.5 size-5 shrink-0 text-brand-text" />
            <span>
              <span className="block text-sm font-medium">{m.title}</span>
              <span className="block text-xs text-muted-foreground">{m.body}</span>
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={start} disabled={starting} className="h-12 px-6 text-[15px]">
        {starting ? <Loader2Icon className="animate-spin" /> : <PhoneCallIcon />}
        {starting ? "Preparing your interviewer…" : "Start interview"}
      </Button>
    </div>
  )
}
