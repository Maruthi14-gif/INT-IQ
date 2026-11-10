"use client"

import { CheckIcon, CircleAlertIcon, Loader2Icon, MicIcon, MicOffIcon, PhoneOffIcon, SparklesIcon, VideoIcon, VideoOffIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { CopilotPlan, LiveInterviewEvaluation, LiveInterviewStatus, LiveSignalKind, LiveTranscriptTurn } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

type CopilotSuggestions = { followUps: string[]; technicalChecks: string[]; unexploredTopics: string[] }
type EvaluationDraft = Omit<LiveInterviewEvaluation, "approvedAt">

export type LiveRoomData = {
  id: string
  role: "recruiter" | "candidate"
  status: LiveInterviewStatus
  scheduledAt: string | null
  recruiterJoined: boolean
  candidateJoined: boolean
  transcription: { youConsented: boolean; otherConsented: boolean }
  job: { title: string; company: string }
  candidateName: string
  transcript?: LiveTranscriptTurn[]
  copilotPlan?: CopilotPlan | null
  recruiterNotes?: string | null
  finalEvaluation?: LiveInterviewEvaluation | null
}

type Signal = { id: string; kind: LiveSignalKind; payload: Record<string, unknown> }

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => Recognition

function getRecognitionConstructor() {
  const browser = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function description(payload: Record<string, unknown>): RTCSessionDescriptionInit | null {
  const type = payload.type
  const sdp = payload.sdp
  if ((type === "offer" || type === "answer") && typeof sdp === "string") return { type, sdp }
  return null
}

function candidate(payload: Record<string, unknown>): RTCIceCandidateInit | null {
  return typeof payload.candidate === "string" ? payload as RTCIceCandidateInit : null
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Scheduled time unavailable"
}

/**
 * A real P2P interview room. WebRTC carries camera and microphone media directly
 * between the two browsers; the authenticated API only relays SDP/ICE metadata.
 */
export function LiveInterviewRoom({ initial }: { initial: LiveRoomData }) {
  const router = useRouter()
  const [room, setRoom] = useState(initial)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connection, setConnection] = useState<"preparing" | "waiting" | "connected" | "error" | "ended">("preparing")
  const [microphone, setMicrophone] = useState(true)
  const [camera, setCamera] = useState(true)
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const [notes, setNotes] = useState(initial.recruiterNotes ?? "")
  const [notesSaved, setNotesSaved] = useState(initial.recruiterNotes ?? "")
  const [copilotBusy, setCopilotBusy] = useState<"plan" | "suggestions" | "evaluation-draft" | null>(null)
  const [suggestions, setSuggestions] = useState<CopilotSuggestions | null>(null)
  const [draft, setDraft] = useState<EvaluationDraft | null>(null)
  const [savingEvaluation, setSavingEvaluation] = useState(false)
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const media = useRef<MediaStream | null>(null)
  const peer = useRef<RTCPeerConnection | null>(null)
  const seenSignals = useRef(new Set<string>())
  const pendingIce = useRef<RTCIceCandidateInit[]>([])

  const updateRoom = useCallback((next: Partial<LiveRoomData>) => {
    setRoom((current) => ({ ...current, ...next, transcript: next.transcript ?? current.transcript }))
  }, [])

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(path, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.")
    return data
  }, [])

  const sendSignal = useCallback(
    async (kind: LiveSignalKind, payload: Record<string, unknown>) => {
      await request(`/api/live-interviews/${initial.id}/signals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      })
    },
    [initial.id, request],
  )

  const createOffer = useCallback(async () => {
    const pc = peer.current
    if (!pc || pc.signalingState !== "stable") return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await sendSignal("offer", { type: offer.type, sdp: offer.sdp ?? "" })
  }, [sendSignal])

  const applySignal = useCallback(
    async (signal: Signal) => {
      const pc = peer.current
      if (!pc) return
      if (signal.kind === "ice") {
        const ice = candidate(signal.payload)
        if (!ice) return
        if (!pc.remoteDescription) {
          pendingIce.current.push(ice)
          return
        }
        await pc.addIceCandidate(new RTCIceCandidate(ice))
        return
      }
      const remote = description(signal.payload)
      if (!remote) return
      if (remote.type === "offer") {
        await pc.setRemoteDescription(remote)
        for (const ice of pendingIce.current.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(ice))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal("answer", { type: answer.type, sdp: answer.sdp ?? "" })
        return
      }
      if (remote.type === "answer" && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(remote)
        for (const ice of pendingIce.current.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(ice))
      }
    },
    [sendSignal],
  )

  const sync = useCallback(async () => {
    try {
      const [state, signalData] = await Promise.all([
        request(`/api/live-interviews/${initial.id}`),
        request(`/api/live-interviews/${initial.id}/signals`),
      ])
      updateRoom(state as Partial<LiveRoomData>)
      for (const raw of signalData.signals as Signal[]) {
        if (seenSignals.current.has(raw.id)) continue
        if (!peer.current) break
        await applySignal(raw)
        seenSignals.current.add(raw.id)
      }
    } catch (error) {
      // A temporary polling failure should not tear down an otherwise healthy call.
      console.warn("[live-interview] sync failed", error)
    }
  }, [applySignal, initial.id, request, updateRoom])

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    let disposed = false
    async function start() {
      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        } catch (error) {
          if (!(error instanceof Error) || error.name !== "NotFoundError") throw error
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          setCamera(false)
          setCameraAvailable(false)
          toast.info("No camera found. Continuing with audio only.")
        }
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const hasVideo = stream.getVideoTracks().length > 0
        setCameraAvailable(hasVideo)
        setCamera(hasVideo)
        media.current = stream
        setLocalStream(stream)
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
        peer.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        pc.ontrack = (event) => setRemoteStream(event.streams[0] ?? new MediaStream([event.track]))
        pc.onicecandidate = (event) => {
          if (event.candidate) void sendSignal("ice", event.candidate.toJSON() as unknown as Record<string, unknown>).catch(() => {})
        }
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setConnection("connected")
          else if (pc.connectionState === "failed") setConnection("error")
          else if (pc.connectionState === "closed") setConnection("ended")
        }
        const joined = await request(`/api/live-interviews/${initial.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "join" }),
        })
        updateRoom(joined as Partial<LiveRoomData>)
        setConnection("waiting")
        // The recruiter is the deterministic offerer, avoiding negotiation glare.
        if (initial.role === "recruiter") await createOffer()
        await sync()
      } catch (error) {
        setConnection("error")
        toast.error(message(error, "Couldn't access a microphone. Connect or enable one, allow browser access, and refresh the room."))
      }
    }
    void start()
    return () => {
      disposed = true
      peer.current?.close()
      peer.current = null
      media.current?.getTracks().forEach((track) => track.stop())
      media.current = null
    }
    // This session is intentionally set up once; state updates are synchronized separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => void sync(), 1250)
    return () => window.clearInterval(timer)
  }, [sync])

  const saveTranscript = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean) return
      try {
        const data = await request(`/api/live-interviews/${initial.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "transcript", text: clean }),
        })
        if (initial.role === "recruiter" && data.turn) {
          setRoom((current) => ({ ...current, transcript: [...(current.transcript ?? []), data.turn] }))
        }
      } catch (error) {
        console.warn("[live-interview] transcript wasn't saved", error)
      }
    },
    [initial.id, initial.role, request],
  )

  const transcriptionEnabled = room.transcription.youConsented && room.transcription.otherConsented
  useEffect(() => {
    if (!transcriptionEnabled || connection === "ended") return
    const Constructor = getRecognitionConstructor()
    if (!Constructor) {
      toast.message("Live transcription isn't available in this browser. You can still use private notes.")
      return
    }
    let stopped = false
    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-IN"
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) void saveTranscript(result[0]?.transcript ?? "")
      }
    }
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") console.warn("[live-interview] recognition", event.error)
    }
    recognition.onend = () => {
      if (!stopped) {
        try {
          recognition.start()
        } catch {
          // The browser may still be ending its previous recognition session.
        }
      }
    }
    try {
      recognition.start()
    } catch {
      // A recognition service may take a moment to release the microphone.
    }
    return () => {
      stopped = true
      recognition.stop()
    }
  }, [connection, saveTranscript, transcriptionEnabled])

  async function toggleConsent(consented: boolean) {
    try {
      const next = await request(`/api/live-interviews/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "transcription-consent", consented }),
      })
      updateRoom(next as Partial<LiveRoomData>)
    } catch (error) {
      toast.error(message(error, "Couldn't update transcription consent."))
    }
  }

  function toggleMicrophone() {
    localStream?.getAudioTracks().forEach((track) => (track.enabled = !microphone))
    setMicrophone((on) => !on)
  }

  function toggleCamera() {
    localStream?.getVideoTracks().forEach((track) => (track.enabled = !camera))
    setCamera((on) => !on)
  }

  async function saveNotes() {
    if (initial.role !== "recruiter" || notes === notesSaved) return
    try {
      await request(`/api/live-interviews/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "notes", notes }),
      })
      setNotesSaved(notes)
    } catch (error) {
      toast.error(message(error, "Couldn't save private notes."))
    }
  }

  async function runCopilot(action: "plan" | "suggestions" | "evaluation-draft") {
    setCopilotBusy(action)
    try {
      const data = await request(`/api/live-interviews/${initial.id}/copilot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (data.plan) updateRoom({ copilotPlan: data.plan })
      if (data.suggestions) setSuggestions(data.suggestions)
      if (data.draft) setDraft(data.draft)
    } catch (error) {
      toast.error(message(error, "The Copilot couldn't complete that request."))
    } finally {
      setCopilotBusy(null)
    }
  }

  async function approveEvaluation() {
    if (!draft) return
    setSavingEvaluation(true)
    try {
      await request(`/api/live-interviews/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve-evaluation", evaluation: draft }),
      })
      updateRoom({ finalEvaluation: { ...draft, approvedAt: new Date().toISOString() } })
      toast.success("Final evaluation saved to this application.")
    } catch (error) {
      toast.error(message(error, "Couldn't save the final evaluation."))
    } finally {
      setSavingEvaluation(false)
    }
  }

  async function endInterview() {
    if (initial.role !== "recruiter") {
      peer.current?.close()
      router.back()
      return
    }
    if (!window.confirm("End this live interview for both participants? You can still generate and edit an evaluation afterwards.")) return
    try {
      await request(`/api/live-interviews/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      })
      peer.current?.close()
      setConnection("ended")
      updateRoom({ status: "completed" })
      toast.success("Live interview completed. Review the draft evaluation when ready.")
    } catch (error) {
      toast.error(message(error, "Couldn't complete the live interview."))
    }
  }

  const remoteJoined = initial.role === "recruiter" ? room.candidateJoined : room.recruiterJoined
  const transcriptReady = initial.role === "recruiter" && (room.transcript?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Live interview · {dateTime(room.scheduledAt)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{room.job.title} <span className="font-display font-normal text-brand-text italic">at {room.job.company}</span></h1>
        </div>
        <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", connection === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
          <span className={cn("size-2 rounded-full", connection === "connected" ? "bg-emerald-500" : connection === "error" ? "bg-destructive" : "bg-amber-500")} />
          {connection === "preparing" ? "Starting devices…" : connection === "connected" ? "Connected" : connection === "error" ? "Connection needs attention" : room.status === "completed" ? "Interview completed" : remoteJoined ? "Connecting…" : "Waiting for participant"}
        </span>
      </header>

      <div className={cn("grid gap-5", initial.role === "recruiter" ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "max-w-5xl")}> 
        <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <VideoPanel videoRef={remoteVideo} label={initial.role === "recruiter" ? room.candidateName : "Recruiter"} remote connected={Boolean(remoteStream)} cameraOn={Boolean(remoteStream?.getVideoTracks().length)} />
            <VideoPanel videoRef={localVideo} label="You" muted connected={Boolean(localStream)} cameraOn={camera} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-t pt-4">
            <Button type="button" size="icon" variant={microphone ? "outline" : "destructive"} onClick={toggleMicrophone} aria-label={microphone ? "Mute microphone" : "Unmute microphone"}>
              {microphone ? <MicIcon /> : <MicOffIcon />}
            </Button>
            <Button type="button" size="icon" variant={camera ? "outline" : "destructive"} onClick={toggleCamera} disabled={!cameraAvailable} aria-label={cameraAvailable ? (camera ? "Turn camera off" : "Turn camera on") : "Camera unavailable"}>
              {camera ? <VideoIcon /> : <VideoOffIcon />}
            </Button>
            <Button type="button" variant="destructive" onClick={endInterview} className="gap-2">
              <PhoneOffIcon /> {initial.role === "recruiter" ? "End interview" : "Leave room"}
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={room.transcription.youConsented} onChange={(event) => void toggleConsent(event.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>
                <span className="font-medium">Allow live transcription</span>
                <span className="mt-0.5 block text-muted-foreground">Only consented text is saved. INT-IQ does not record or store this call&rsquo;s audio or video.</span>
              </span>
            </label>
            {room.transcription.youConsented && !room.transcription.otherConsented && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Waiting for the other participant&rsquo;s consent. Transcription stays off until both agree.</p>}
            {transcriptionEnabled && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><CheckIcon className="size-3.5" /> Both participants consented. Browser speech recognition is saving spoken text.</p>}
          </div>

          {connection === "error" && (
            <p role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" /> Connect or enable a microphone, allow browser access, then refresh this room. If your network blocks direct WebRTC, use a network that permits calls.
            </p>
          )}
        </section>

        {initial.role === "recruiter" && (
          <aside className="space-y-4">
            <CopilotPanel
              room={room}
              notes={notes}
              notesSaved={notesSaved}
              onNotesChange={setNotes}
              onSaveNotes={() => void saveNotes()}
              busy={copilotBusy}
              onRun={runCopilot}
              suggestions={suggestions}
              transcriptReady={transcriptReady}
              draft={draft}
              onDraftChange={setDraft}
              onApprove={() => void approveEvaluation()}
              savingEvaluation={savingEvaluation}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

function VideoPanel({ videoRef, label, muted = false, connected, cameraOn = true, remote = false }: { videoRef: React.RefObject<HTMLVideoElement | null>; label: string; muted?: boolean; connected: boolean; cameraOn?: boolean; remote?: boolean }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-950">
      <video ref={videoRef} autoPlay playsInline muted={muted} className={cn("size-full object-cover", muted && "-scale-x-100", !connected && "hidden")} />
      {(!connected || !cameraOn) && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
          <VideoOffIcon className="size-8" />
          {connected && <span className="text-xs">{remote ? "Audio only" : "Camera off"}</span>}
        </span>
      )}
      <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">{label}</span>
    </div>
  )
}

function CopilotPanel({ room, notes, notesSaved, onNotesChange, onSaveNotes, busy, onRun, suggestions, transcriptReady, draft, onDraftChange, onApprove, savingEvaluation }: {
  room: LiveRoomData
  notes: string
  notesSaved: string
  onNotesChange: (value: string) => void
  onSaveNotes: () => void
  busy: "plan" | "suggestions" | "evaluation-draft" | null
  onRun: (action: "plan" | "suggestions" | "evaluation-draft") => void
  suggestions: CopilotSuggestions | null
  transcriptReady: boolean
  draft: EvaluationDraft | null
  onDraftChange: (draft: EvaluationDraft | null) => void
  onApprove: () => void
  savingEvaluation: boolean
}) {
  const plan = room.copilotPlan
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-medium"><SparklesIcon className="size-4 text-brand-text" /> Interview Copilot</h2><p className="mt-1 text-xs text-muted-foreground">Private recruiter guidance. It does not make hiring decisions.</p></div>
          <Button type="button" size="sm" variant="outline" onClick={() => onRun("plan")} disabled={busy !== null}>{busy === "plan" && <Loader2Icon className="animate-spin" />}{plan ? "Refresh plan" : "Prepare plan"}</Button>
        </div>
        {plan ? <PlanView plan={plan} /> : <p className="mt-3 text-sm text-muted-foreground">Generate a plan from the candidate&rsquo;s resume and this job before you begin.</p>}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium" htmlFor="live-notes">Private observations <span className="text-xs font-normal text-muted-foreground">{notes === notesSaved ? "Saved" : "Unsaved"}</span></label>
        <Textarea id="live-notes" value={notes} onChange={(event) => onNotesChange(event.target.value)} onBlur={onSaveNotes} placeholder="Evidence, follow-ups, or observations only you can see." maxLength={6000} className="mt-2 min-h-28" />
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium">During the interview</h2><p className="mt-1 text-xs text-muted-foreground">Suggestions use the transcript only after both people consent.</p></div><Button type="button" size="sm" variant="outline" onClick={() => onRun("suggestions")} disabled={busy !== null || !transcriptReady}>{busy === "suggestions" && <Loader2Icon className="animate-spin" />}Get suggestions</Button></div>
        {!transcriptReady && <p className="mt-3 text-sm text-muted-foreground">Enable consented transcription and wait for at least one saved line to get context-aware suggestions.</p>}
        {suggestions && <SuggestionView suggestions={suggestions} />}
      </section>

      {room.status === "completed" && (
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium">Final evaluation</h2><p className="mt-1 text-xs text-muted-foreground">Generate a draft, edit it, then explicitly approve it. This does not alter application status.</p></div><Button type="button" size="sm" variant="outline" onClick={() => onRun("evaluation-draft")} disabled={busy !== null || (!transcriptReady && !notes.trim())}>{busy === "evaluation-draft" && <Loader2Icon className="animate-spin" />}Generate draft</Button></div>
          {room.finalEvaluation && <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CheckIcon className="size-4" /> Final evaluation approved and saved.</p>}
          {draft && <EvaluationEditor draft={draft} onChange={onDraftChange} onApprove={onApprove} saving={savingEvaluation} />}
        </section>
      )}
    </div>
  )
}

function PlanView({ plan }: { plan: CopilotPlan }) {
  return <div className="mt-4 space-y-3 text-sm"><List title="Focus areas" items={plan.focusAreas} /><List title="Verify" items={plan.verificationSkills} /><List title="Project questions" items={plan.projectQuestions} /><div><p className="text-xs font-medium text-muted-foreground uppercase">Structured plan</p><ol className="mt-1.5 space-y-2">{plan.interviewPlan.map((stage) => <li key={stage.stage} className="rounded-lg bg-muted/60 p-2.5"><span className="font-medium">{stage.stage}</span><span className="block text-xs text-muted-foreground">{stage.aim}</span>{stage.questions.map((question) => <p key={question} className="mt-1 text-sm">{question}</p>)}</li>)}</ol></div></div>
}

function SuggestionView({ suggestions }: { suggestions: CopilotSuggestions }) {
  return <div className="mt-4 space-y-3 text-sm"><List title="Follow-up questions" items={suggestions.followUps} /><List title="Technical checks" items={suggestions.technicalChecks} /><List title="Unexplored topics" items={suggestions.unexploredTopics} /></div>
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return <div><p className="text-xs font-medium text-muted-foreground uppercase">{title}</p><ul className="mt-1.5 space-y-1.5 text-sm">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-current" />{item}</li>)}</ul></div>
}

function EvaluationEditor({ draft, onChange, onApprove, saving }: { draft: EvaluationDraft; onChange: (draft: EvaluationDraft) => void; onApprove: () => void; saving: boolean }) {
  const update = <K extends keyof EvaluationDraft>(key: K, value: EvaluationDraft[K]) => onChange({ ...draft, [key]: value })
  return <div className="mt-4 space-y-3"><Textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} aria-label="Evaluation summary" className="min-h-24" /><Textarea value={draft.strengths.join("\n")} onChange={(event) => update("strengths", event.target.value.split("\n").map((value) => value.trim()).filter(Boolean))} aria-label="Strengths, one per line" placeholder="Strengths, one per line" className="min-h-20" /><Textarea value={draft.weaknesses.join("\n")} onChange={(event) => update("weaknesses", event.target.value.split("\n").map((value) => value.trim()).filter(Boolean))} aria-label="Weaknesses, one per line" placeholder="Weaknesses, one per line" className="min-h-20" /><Textarea value={draft.evidence.join("\n")} onChange={(event) => update("evidence", event.target.value.split("\n").map((value) => value.trim()).filter(Boolean))} aria-label="Evidence, one per line" placeholder="Evidence, one per line" className="min-h-20" /><Textarea value={draft.recommendation} onChange={(event) => update("recommendation", event.target.value)} aria-label="Recruiter recommendation" className="min-h-20" /><Button type="button" onClick={onApprove} disabled={saving || !draft.summary.trim() || !draft.evidence.length}>{saving && <Loader2Icon className="animate-spin" />}Approve and save evaluation</Button></div>
}
