"use client"

import {
  BrainCircuitIcon,
  HandshakeIcon,
  KeyboardIcon,
  Loader2Icon,
  MicIcon,
  PhoneCallIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { InterviewMode, InterviewType } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

const ROUNDS: { type: InterviewType; title: string; body: string; icon: LucideIcon }[] = [
  { type: "technical", title: "Technical", body: "Fundamentals, your projects, and a small problem to solve.", icon: BrainCircuitIcon },
  { type: "behavioral", title: "Behavioral", body: "Teamwork, conflict, failure and ownership, with real examples.", icon: UsersIcon },
  { type: "hr", title: "HR", body: "Motivation, strengths, goals, and why this role.", icon: HandshakeIcon },
]

const MODES: { mode: InterviewMode; title: string; body: string; icon: LucideIcon }[] = [
  {
    mode: "voice",
    title: "Voice call",
    body: "A real-time conversation. Talk naturally; the interviewer listens and replies like a real call.",
    icon: PhoneCallIcon,
  },
  {
    mode: "text",
    title: "Text & mic",
    body: "Read each question, answer by typing or dictation, and edit before you send.",
    icon: KeyboardIcon,
  },
]

const LENGTHS = [
  { value: 3, label: "Quick", hint: "3 questions · ~5 min" },
  { value: 5, label: "Standard", hint: "5 questions · ~10 min" },
  { value: 7, label: "Full", hint: "7 questions · ~15 min" },
]

export function InterviewSetup({
  targetRole,
  hasResume,
  voiceAvailable,
}: {
  targetRole: string | null
  hasResume: boolean
  voiceAvailable: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<InterviewMode>(voiceAvailable ? "voice" : "text")
  const [type, setType] = useState<InterviewType>("technical")
  const [total, setTotal] = useState(5)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, totalQuestions: total, mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the interview. Please try again.")
        setStarting(false)
        return
      }
      router.push(`/interview/${data.id}`)
    } catch {
      setError("Can't reach the server. Check your connection and try again.")
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border bg-card px-5 py-4 text-sm">
        <span className="text-muted-foreground">Preparing for</span>
        <span className="font-medium">{targetRole ?? "Software Developer"}</span>
        <Link href="/resume" className="ml-auto font-medium text-brand-text hover:opacity-80">
          {hasResume ? "Change" : "Add your resume for personal questions →"}
        </Link>
      </div>

      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
          <StepNumber n={1} /> How do you want to answer?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map(({ mode: m, title, body, icon: Icon }) => {
            const unavailable = m === "voice" && !voiceAvailable
            return (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={unavailable}
                onClick={() => setMode(m)}
                className={cn(
                  "flex gap-4 rounded-2xl border bg-card p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                  mode === m ? "border-brand ring-3 ring-brand/20" : "hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl border",
                    mode === m ? "bg-brand text-primary-foreground" : "bg-brand-soft text-brand-text",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">
                    {title}
                    {m === "voice" && voiceAvailable && (
                      <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-text">Recommended</span>
                    )}
                    {unavailable && <span className="ml-2 text-xs font-normal text-muted-foreground">Not set up yet</span>}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
          <StepNumber n={2} /> Which round do you want to practice?
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {ROUNDS.map(({ type: t, title, body, icon: Icon }) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-2xl border bg-card p-5 text-left transition-all",
                type === t ? "border-brand ring-3 ring-brand/20" : "hover:bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl border",
                  type === t ? "bg-brand text-primary-foreground" : "bg-brand-soft text-brand-text",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="mt-4 block font-medium">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
          <StepNumber n={3} /> How long?
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {LENGTHS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={total === l.value}
              onClick={() => setTotal(l.value)}
              className={cn(
                "rounded-xl border bg-card px-4 py-3 text-left transition-colors",
                total === l.value ? "border-brand bg-brand-soft" : "hover:bg-accent/50",
              )}
            >
              <span className="block text-sm font-medium">{l.label}</span>
              <span className="block text-xs text-muted-foreground">{l.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <p className="text-sm" data-testid="interview-summary">
          <span className="text-muted-foreground">You&rsquo;ll do a </span>
          <span className="font-medium">
            {total}-question {ROUNDS.find((r) => r.type === type)?.title} interview
          </span>
          <span className="text-muted-foreground"> by </span>
          <span className="font-medium">{mode === "voice" ? "voice call" : "text & mic"}</span>
          <span className="text-muted-foreground"> · about {LENGTHS.find((l) => l.value === total)?.hint.split("~")[1]}.</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {mode === "voice"
            ? "Next: press Start in the interview room and allow your microphone and camera. The interviewer greets you, then you answer out loud like a phone call. Headphones help."
            : "Next: allow your camera, then the interviewer reads each question. Tap Start speaking and answer out loud, or type, then press Send. Works best in Chrome or Edge."}
        </p>
        <Button onClick={start} disabled={starting} className="h-12 px-6 text-[15px]">
          {starting ? <Loader2Icon className="animate-spin" /> : <MicIcon />}
          {starting ? "Preparing your interviewer…" : "Start interview"}
        </Button>
      </div>
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-text">
      {n}
    </span>
  )
}
