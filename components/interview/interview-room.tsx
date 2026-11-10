"use client"

import {
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RotateCcwIcon,
  SendIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { toast } from "sonner"
import { VoiceBars, VoiceOrb } from "@/components/brand/voice-orb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { InterviewType } from "@/lib/db/schema"
import { useDictation, useRecognitionSupported, useSpeaker } from "@/lib/speech"
import { cn } from "@/lib/utils"
import { ProctorCam, ProctorNotice, useProctor } from "./proctor"

type Props = {
  id: string
  type: InterviewType
  targetRole: string
  totalQuestions: number
  initialQuestion: string
  initialNumber: number
  /** The last question was answered but the next one wasn't generated (AI error). */
  awaitingNext: boolean
  startedAt: string
}

type Phase = "ready" | "asking" | "answering" | "thinking" | "scoring"

const ROUND_LABEL: Record<InterviewType, string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR" }

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function InterviewRoom(props: Props) {
  const router = useRouter()
  const [question, setQuestion] = useState(props.initialQuestion)
  const [visibleQuestion, setVisibleQuestion] = useState(props.awaitingNext ? props.initialQuestion : "")
  const [number, setNumber] = useState(props.initialNumber)
  const [phase, setPhase] = useState<Phase>(props.awaitingNext ? "answering" : "ready")
  const [draft, setDraft] = useState("")
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(
    props.awaitingNext ? "Your last answer was saved. Tap Try again for the next question." : null,
  )
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(props.awaitingNext ? "" : null)
  const [elapsed, setElapsed] = useState(0)
  const micWanted = useRef(false) // user turned the mic on at least once: auto-listen after each question
  const questionRevealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const recognitionSupported = useRecognitionSupported()
  const speaker = useSpeaker()
  const dictation = useDictation(setDraft)
  const isLast = number >= props.totalQuestions
  const proctor = useProctor({ interviewId: props.id, mode: "text" })
  const startProctor = proctor.start

  // Anti-cheat camera runs for the whole interview.
  useEffect(() => {
    void startProctor()
  }, [startProctor])

  // Interview timer
  useEffect(() => {
    const start = new Date(props.startedAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [props.startedAt])

  const stopQuestionReveal = useCallback(() => {
    if (questionRevealTimer.current) clearInterval(questionRevealTimer.current)
    questionRevealTimer.current = null
  }, [])

  const revealQuestion = useCallback(
    (text: string) => {
      stopQuestionReveal()
      const words = text.match(/\S+\s*/g) ?? [text]
      let visibleWords = 0
      setVisibleQuestion("")

      const revealNextWord = () => {
        visibleWords += 1
        setVisibleQuestion(words.slice(0, visibleWords).join("").trimEnd())
        if (visibleWords >= words.length) stopQuestionReveal()
      }

      revealNextWord()
      if (words.length > 1) questionRevealTimer.current = setInterval(revealNextWord, 280)
    },
    [stopQuestionReveal],
  )

  useEffect(() => stopQuestionReveal, [stopQuestionReveal])

  const listen = useCallback(() => {
    speaker.stop()
    stopQuestionReveal()
    setVisibleQuestion(question)
    if (dictation.start(draft)) {
      micWanted.current = true
      setPhase("answering")
    } else {
      setPhase("answering")
    }
  }, [dictation, draft, question, speaker, stopQuestionReveal])

  const ask = useCallback(
    (text: string) => {
      setPhase("asking")
      if (muted) {
        stopQuestionReveal()
        setVisibleQuestion(text)
        setPhase("answering")
        if (micWanted.current) dictation.start("")
        return
      }
      revealQuestion(text)
      speaker.speak(text, () => {
        stopQuestionReveal()
        setVisibleQuestion(text)
        setPhase("answering")
        if (micWanted.current) dictation.start("")
      })
    },
    [dictation, muted, revealQuestion, speaker, stopQuestionReveal],
  )

  // Ask the first question when the room opens. `ask` changes on every render, so the
  // timer reads the latest one from a ref instead of re-running (and cancelling) itself.
  const askRef = useRef(ask)
  useEffect(() => {
    askRef.current = ask
  })
  useEffect(() => {
    if (props.awaitingNext) return
    const t = setTimeout(() => askRef.current(props.initialQuestion), 400)
    return () => clearTimeout(t)
  }, [props.awaitingNext, props.initialQuestion])

  async function send(answer: string) {
    dictation.stop()
    speaker.stop()
    setError(null)
    setPendingAnswer(answer)
    setPhase(isLast ? "scoring" : "thinking")
    try {
      // Save the anti-cheat counts first: the last answer builds the report.
      if (isLast) await proctor.stop()
      else void proctor.flush()
      const res = await fetch(`/api/interviews/${props.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.")
      setPendingAnswer(null)
      if (data.done) {
        router.push(`/reports/${props.id}`)
        return
      }
      setDraft("")
      setQuestion(data.question)
      setNumber(data.number)
      ask(data.question)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
      setPhase("answering")
      if (isLast) void proctor.start()
    }
  }

  async function finishEarly() {
    if (!window.confirm("End the interview now? You'll get a report for the questions you've answered.")) return
    dictation.stop()
    speaker.stop()
    setPhase("scoring")
    try {
      await proctor.stop()
      const res = await fetch(`/api/interviews/${props.id}/finish`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 400) {
        toast.info("No answers yet, so there's no report. You can come back to this interview later.")
        router.push("/dashboard")
        return
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't finish. Please try again.")
      router.push(`/reports/${props.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish. Please try again.")
      setPhase("answering")
      void proctor.start()
    }
  }

  /** Answers must be the candidate's own words: pasting is blocked and noted in the report. */
  function blockPaste(e: ClipboardEvent | DragEvent) {
    e.preventDefault()
    proctor.notePaste()
    toast.warning("Pasting is turned off during the interview. Answer in your own words.")
  }

  function submit() {
    if (pendingAnswer !== null) return send(pendingAnswer)
    if (!draft.trim() && !window.confirm("Skip this question without answering?")) return
    return send(draft)
  }

  // Ctrl/Cmd + Enter submits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && phase === "answering") {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const busy = phase === "thinking" || phase === "scoring"
  const status =
    speaker.blocked && phase === "asking"
      ? "Tap replay to hear the question"
      : phase === "asking"
      ? "Interviewer is speaking — listen"
      : phase === "thinking"
        ? "Interviewer is thinking…"
        : phase === "scoring"
          ? "Scoring your interview"
          : dictation.listening
            ? "Listening to you — tap Pause mic when done"
            : phase === "answering"
              ? "Your turn — tap Start speaking, or type"
              : "Getting ready"

  if (phase === "scoring") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="status">
        <VoiceOrb className="size-32" speaking />
        <h2 className="mt-8 text-2xl font-medium">Scoring your interview…</h2>
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
        <span className="text-sm text-muted-foreground">{props.targetRole}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tabular-nums" aria-label="Elapsed time">
            {formatTime(elapsed)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setMuted((m) => !m)
              speaker.stop()
              stopQuestionReveal()
              setVisibleQuestion(question)
              if (phase === "asking") setPhase("answering")
            }}
            aria-label={muted ? "Turn interviewer voice on" : "Mute interviewer voice"}
          >
            {muted ? <VolumeXIcon /> : <Volume2Icon />}
          </Button>
          <Button variant="destructive" onClick={finishEarly} disabled={busy} className="h-8">
            <PhoneOffIcon />
            End
          </Button>
        </div>
      </div>

      {/* progress */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>
            Question {number} of {props.totalQuestions}
          </span>
          <span>{Math.round(((number - 1) / props.totalQuestions) * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${((number - 1) / props.totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* interviewer */}
      <section
        aria-label="Interviewer"
        className="relative rounded-2xl bg-stage px-6 py-10 text-center text-stage-foreground ring-1 ring-white/10 sm:px-12"
      >
        <ProctorCam proctor={proctor} className="absolute top-3 right-3" />
        <VoiceOrb className={cn("mx-auto size-28 transition-opacity", busy && "opacity-60")} speaking={speaker.speaking || busy} />
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60" aria-live="polite">
          {dictation.listening && <VoiceBars className="h-3 text-emerald-300" bars={4} />}
          {busy && <Loader2Icon className="size-3.5 animate-spin" />}
          {status}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl" data-testid="interview-question">
          {busy ? "…" : visibleQuestion}
        </p>
        {!busy && (
          <button
            type="button"
            onClick={() => ask(question)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/10"
          >
            <RotateCcwIcon className="size-3.5" />
            {speaker.blocked ? "Tap to hear the question" : "Replay question"}
          </button>
        )}
        <ProctorNotice proctor={proctor} className="mt-4" />
      </section>

      {/* answer */}
      <section aria-label="Your answer" className="rounded-2xl border bg-card p-4 sm:p-5">
        <ol className="mb-3 flex flex-wrap gap-x-4 gap-y-1 border-b pb-3 text-xs text-muted-foreground">
          <li><span className="font-semibold text-brand-text">1</span> {recognitionSupported ? "Tap Start speaking and answer out loud (or type)" : "Type your answer"}</li>
          <li><span className="font-semibold text-brand-text">2</span> Check the text below</li>
          <li><span className="font-semibold text-brand-text">3</span> Press {isLast ? "Finish interview" : "Send answer"}</li>
        </ol>
        <Textarea
          value={pendingAnswer ?? draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={blockPaste}
          onDrop={blockPaste}
          readOnly={dictation.listening || busy || pendingAnswer !== null}
          placeholder={
            recognitionSupported
              ? "Tap Start speaking and answer out loud. Your words appear here, and you can edit them before sending."
              : "Type your answer here. (Voice answers work in Chrome and Edge.)"
          }
          aria-label="Your answer"
          className="min-h-36 resize-none border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {dictation.micBlocked && (
          <p role="alert" className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            Microphone is blocked. Allow it from the lock icon in the address bar, or type your answer.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-4">
          {recognitionSupported && (
            <Button
              type="button"
              variant={dictation.listening ? "destructive" : "outline"}
              onClick={() => (dictation.listening ? dictation.stop() : listen())}
              disabled={busy || pendingAnswer !== null}
              className="h-11 px-4"
              aria-pressed={dictation.listening}
            >
              {dictation.listening ? <MicOffIcon /> : <MicIcon />}
              {dictation.listening ? "Pause mic" : draft ? "Continue speaking" : "Start speaking"}
            </Button>
          )}
          <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl + Enter to send</span>
          <Button
            onClick={submit}
            disabled={busy || phase === "ready"}
            variant={!draft.trim() && pendingAnswer === null ? "outline" : "default"}
            className="ml-auto h-11 px-5"
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            {pendingAnswer !== null ? "Try again" : !draft.trim() ? "Skip question" : isLast ? "Finish interview" : "Send answer"}
          </Button>
        </div>
      </section>
    </div>
  )
}
