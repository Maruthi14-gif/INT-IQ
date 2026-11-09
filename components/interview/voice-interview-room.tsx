"use client"

import type Vapi from "@vapi-ai/web"
import {
  KeyboardIcon,
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  RotateCcwIcon,
  WifiOffIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { InterviewType } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { preloadProctor, ProctorCam, ProctorNotice, useProctor } from "./proctor"

type Props = {
  id: string
  type: InterviewType
  targetRole: string
  totalQuestions: number
  initialAsked: number
  initialAnswered: number
  initialQuestion: string
}

type Status = "idle" | "connecting" | "live" | "dropped" | "scoring"
type Line = { role: "assistant" | "user"; text: string; partial: string; final: boolean }
type Progress = { asked: number; answered: number; total: number; currentQuestion: string | null }

const ROUND_LABEL: Record<InterviewType, string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR" }
const CLOSING_HINT = "preparing your report"

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Friendly text for mic / network problems reported by the SDK. */
function describeStartError(raw: unknown): string {
  const text = JSON.stringify(raw ?? "").toLowerCase()
  if (/notallowed|permission|denied|microphone-preflight/.test(text)) {
    return "Microphone access is blocked. Allow it from the lock icon in the address bar, then try again."
  }
  if (/notfound|no microphone|requested device not found/.test(text)) {
    return "No microphone found. Plug one in, or switch to text mode."
  }
  if (/already finished|all questions/.test(text)) return "All questions are answered. Get your report below."
  if (/not set up|vapi_private_key/.test(text)) return "Voice interviews aren't set up yet. Switch to text mode."
  if (/failed to fetch|network|timeout/.test(text)) return "Couldn't connect. Check your internet and try again."
  return "The voice call couldn't start. Try again, or switch to text mode."
}

export function VoiceInterviewRoom(props: Props) {
  const router = useRouter()
  const vapiRef = useRef<Vapi | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [assistantSpeaking, setAssistantSpeaking] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [muted, setMuted] = useState(false)
  const [weakNetwork, setWeakNetwork] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [seconds, setSeconds] = useState(0)
  const [progress, setProgress] = useState<Progress>({
    asked: props.initialAsked,
    answered: props.initialAnswered,
    total: props.totalQuestions,
    currentQuestion: props.initialQuestion,
  })
  const endedByUser = useRef(false)
  const closingHeard = useRef(false)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  const proctor = useProctor({ interviewId: props.id, mode: "voice" })
  const stopProctor = proctor.stop

  const allAnswered = progress.answered >= progress.total

  // Download the face-check models while the candidate reads the tips.
  useEffect(() => preloadProctor(), [])

  const refreshProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/interviews/${props.id}`, { cache: "no-store" })
      if (!res.ok) return null
      const data = (await res.json()) as Progress & { status: string }
      setProgress({ asked: data.asked, answered: data.answered, total: data.total, currentQuestion: data.currentQuestion })
      return data
    } catch {
      return null
    }
  }, [props.id])

  const finish = useCallback(async () => {
    setStatus("scoring")
    await stopProctor() // camera off, anti-cheat counts saved before the report is built
    try {
      const res = await fetch(`/api/interviews/${props.id}/finish`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 400) {
        toast.info("No answers yet, so there's no report. You can come back to this interview later.")
        router.push("/dashboard")
        return
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the report.")
      router.push(`/reports/${props.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the report. Try again.")
      setStatus("dropped")
    }
  }, [props.id, router, stopProctor])

  // Call timer
  useEffect(() => {
    if (status !== "live") return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  // Keep the newest transcript line in view
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest" })
  }, [lines])

  // Warn before leaving mid-call
  useEffect(() => {
    if (status !== "live" && status !== "connecting") return
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [status])

  // Hang up if the user navigates away
  useEffect(() => () => void vapiRef.current?.stop(), [])

  async function getVapi() {
    if (vapiRef.current) return vapiRef.current
    const { default: VapiClient } = await import("@vapi-ai/web")
    // Calls go through our server (/api/vapi/call/web), which holds the Vapi key.
    const vapi = new VapiClient("int-iq", `${window.location.origin}/api/vapi`)

    vapi.on("call-start", () => {
      setStatus("live")
      setError(null)
      refreshProgress()
    })
    vapi.on("speech-start", () => {
      setAssistantSpeaking(true)
      refreshProgress()
    })
    vapi.on("speech-end", () => setAssistantSpeaking(false))
    vapi.on("local-volume-level", (level: number) => setMicLevel(level))
    vapi.on("network-quality-change", (e: { quality?: string }) => setWeakNetwork(e?.quality === "low" || e?.quality === "very-low"))
    vapi.on("message", (message: { type?: string; role?: string; transcriptType?: string; transcript?: string }) => {
      if (message.type !== "transcript" || !message.transcript) return
      const role = message.role === "assistant" ? "assistant" : "user"
      const final = message.transcriptType === "final"
      if (role === "assistant" && final && message.transcript.toLowerCase().includes(CLOSING_HINT)) closingHeard.current = true
      // One paragraph per speaker turn: final phrases are appended, the live partial shows after them.
      setLines((prev) => {
        const next = [...prev]
        const last = next.at(-1)
        const text = message.transcript!.trim()
        if (last && last.role === role) {
          next[next.length - 1] = final
            ? { role, text: `${last.text} ${text}`.trim(), partial: "", final: true }
            : { ...last, partial: text, final: false }
        } else {
          next.push(final ? { role, text, partial: "", final: true } : { role, text: "", partial: text, final: false })
        }
        return next.slice(-40)
      })
    })
    vapi.on("call-start-failed", (e: { stage?: string; error?: string }) => {
      setStatus("idle")
      setError(describeStartError(e))
    })
    vapi.on("error", (e: unknown) => {
      console.warn("[voice] error", e)
      setError((current) => current ?? describeStartError(e))
    })
    vapi.on("call-end", async () => {
      setAssistantSpeaking(false)
      setMicLevel(0)
      const state = await refreshProgress()
      const done = closingHeard.current || (state ? state.answered >= state.total : false)
      if (endedByUser.current || done) {
        if (state && state.answered === 0) {
          router.push("/dashboard")
          return
        }
        finish()
        return
      }
      // The call dropped (network, tab sleep, service hiccup). Answers so far are saved.
      setStatus("dropped")
    })

    vapiRef.current = vapi
    return vapi
  }

  async function start() {
    setError(null)
    endedByUser.current = false
    closingHeard.current = false
    if (allAnswered) return finish()

    // Ask early so a blocked mic gets a clear message instead of a failed call.
    try {
      const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName })
      if (permission?.state === "denied") {
        setError(describeStartError("permission denied"))
        return
      }
    } catch {
      /* Some browsers can't query mic permission; the SDK will ask. */
    }

    setStatus("connecting")
    // Wake up the voice agent endpoint now, so the first answer doesn't wait for a cold start.
    void fetch(`/api/vapi/llm/${props.id}/chat/completions`).catch(() => {})
    // Anti-cheat camera (resolves once the camera is allowed or refused; the call starts either way).
    await proctor.start()
    try {
      const vapi = await getVapi()
      // The SDK requires an assistant argument; our server ignores this placeholder and
      // builds the real interviewer for this interview id.
      const call = await vapi.start("int-iq-interviewer", { metadata: { interviewId: props.id } })
      if (!call) {
        setStatus((s) => (s === "connecting" ? "idle" : s))
      }
    } catch (e) {
      setStatus("idle")
      setError(describeStartError(e))
    }
  }

  async function end() {
    const message =
      progress.answered > 0
        ? "End the interview now? You'll get a report for the questions you've answered."
        : "End the interview? You haven't answered anything yet, so there won't be a report."
    if (!window.confirm(message)) return
    endedByUser.current = true
    if (status === "live" || status === "connecting") await vapiRef.current?.stop()
    else if (progress.answered > 0) finish()
    else router.push("/dashboard")
  }

  function toggleMute() {
    const vapi = vapiRef.current
    if (!vapi) return
    vapi.setMuted(!muted)
    setMuted(!muted)
  }

  const questionNumber = Math.min(progress.total, Math.max(1, progress.asked))
  const live = status === "live"
  const statusText =
    status === "connecting"
      ? "Connecting… allow the microphone if your browser asks"
      : status === "live"
        ? assistantSpeaking
          ? "Interviewer is speaking — listen"
          : muted
            ? "Your mic is muted — unmute to answer"
            : "Your turn — answer out loud"
        : status === "dropped"
          ? "Call ended"
          : "Ready when you are"

  if (status === "scoring") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="status">
        <VoiceOrb className="size-32" />
        <h2 className="mt-8 text-2xl font-semibold tracking-tight">Scoring your interview…</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Reviewing every answer and writing your feedback. This takes about 10 seconds.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{ROUND_LABEL[props.type]} round</Badge>
        <Badge variant="outline" className="gap-1">
          <PhoneCallIcon className="size-3" /> Voice call
        </Badge>
        <span className="text-sm text-muted-foreground">{props.targetRole}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tabular-nums" aria-label="Call time">
            {formatTime(seconds)}
          </span>
          {live && (
            <Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted}>
              {muted ? <MicOffIcon /> : <MicIcon />}
            </Button>
          )}
          <Button variant="destructive" onClick={end} className="h-8">
            <PhoneOffIcon />
            End
          </Button>
        </div>
      </div>

      {/* progress */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>
            Question {questionNumber} of {progress.total}
          </span>
          <span>{Math.round((progress.answered / progress.total) * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
        </div>
      </div>

      {/* interviewer */}
      <section
        aria-label="Interviewer"
        className="relative isolate overflow-hidden rounded-2xl bg-[#0d0c1d] px-6 py-10 text-center text-white ring-1 ring-white/10 sm:px-12"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_50%_0%,rgb(99_102_241/0.4),transparent_70%)]" />
        <ProctorCam proctor={proctor} className="absolute top-3 right-3" />
        <VoiceOrb
          className={cn("mx-auto size-28 transition-opacity", !live && "opacity-70")}
          speaking={assistantSpeaking || status === "connecting"}
        />
        <p className="mt-6 flex items-center justify-center gap-2 text-xs font-medium tracking-wide text-white/60 uppercase" aria-live="polite">
          {status === "connecting" && <Loader2Icon className="size-3.5 animate-spin" />}
          {live && !assistantSpeaking && !muted && <MicLevel level={micLevel} />}
          {statusText}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl" data-testid="interview-question">
          {progress.currentQuestion}
        </p>
        <ProctorNotice proctor={proctor} className="mt-4" />
        {live && !assistantSpeaking && !muted && !proctor.warning && (
          <p className="mt-4 text-xs text-white/55">When you finish your answer, pause for a second and the interviewer will reply.</p>
        )}

        {(status === "idle" || status === "dropped") && (
          <div className="mt-8 flex flex-col items-center gap-3">
            {allAnswered ? (
              <Button onClick={finish} className="h-12 bg-white px-6 text-[15px] text-[#0d0c1d] hover:bg-white/90">
                Get my report
              </Button>
            ) : (
              <Button onClick={start} className="h-12 bg-white px-6 text-[15px] text-[#0d0c1d] hover:bg-white/90">
                {status === "dropped" ? <RotateCcwIcon /> : <PhoneCallIcon />}
                {status === "dropped" || progress.answered > 0 ? "Reconnect and continue" : "Start voice interview"}
              </Button>
            )}
            <ol className="mt-2 grid max-w-xl gap-2 text-left text-xs text-white/70 sm:grid-cols-3">
              {[
                "Press the button and allow your microphone and camera.",
                "Answer out loud, like a phone call. Pause for a second when you are done.",
                "After the last question it ends by itself and shows your report.",
              ].map((tip, i) => (
                <li key={tip} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <span className="font-semibold text-indigo-300">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ol>
            <p className="max-w-xl text-xs text-white/55">
              Anti-cheat: your camera checks that you stay in view, look at the screen and don’t use a phone or other
              tabs. Video never leaves your device; only the counts are saved in your report.
            </p>
          </div>
        )}
      </section>

      {/* problems */}
      {(error || weakNetwork || status === "dropped") && (
        <div role="alert" className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
          {status === "dropped" && !error && (
            <p className="flex items-center gap-2">
              <WifiOffIcon className="size-4 text-warning" />
              The call ended early. Your answers so far are saved, so you can reconnect and carry on.
            </p>
          )}
          {weakNetwork && live && (
            <p className="flex items-center gap-2">
              <WifiOffIcon className="size-4 text-warning" />
              Your connection looks weak. The interviewer may sound choppy.
            </p>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {status !== "live" && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-9">
                <Link href={`/interview/${props.id}?mode=text`}>
                  <KeyboardIcon />
                  Switch to text mode
                </Link>
              </Button>
              {progress.answered > 0 && !allAnswered && (
                <Button variant="ghost" className="h-9" onClick={finish}>
                  End and get my report
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* transcript */}
      <section aria-label="Live transcript" className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-medium">Live transcript</h2>
          <span className="text-xs text-muted-foreground">Saved automatically</span>
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {live ? "Listening…" : "The conversation will appear here once the call starts."}
            </p>
          ) : (
            lines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">
                <span className={cn("mr-2 text-xs font-medium", line.role === "assistant" ? "text-brand-text" : "text-success")}>
                  {line.role === "assistant" ? "Interviewer" : "You"}
                </span>
                {line.text}
                {line.partial && <span className="text-muted-foreground italic"> {line.partial}</span>}
              </p>
            ))
          )}
          <div ref={transcriptEnd} />
        </div>
      </section>
    </div>
  )
}

/** Small live meter for the candidate's microphone. */
function MicLevel({ level }: { level: number }) {
  const bars = [0.35, 0.7, 1, 0.7, 0.35]
  return (
    <span className="inline-flex h-3.5 items-center gap-[3px]" aria-hidden>
      {bars.map((weight, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-emerald-300 transition-[height] duration-100"
          style={{ height: `${Math.max(20, Math.min(100, level * 160 * weight))}%` }}
        />
      ))}
    </span>
  )
}
