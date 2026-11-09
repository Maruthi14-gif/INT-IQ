"use client"

import type { Classifications, FaceLandmarker, Matrix, ObjectDetector } from "@mediapipe/tasks-vision"
import { CameraOffIcon, Loader2Icon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { emptyIntegritySession, type CameraState, type IntegrityFlag, type IntegritySession } from "@/lib/integrity"
import { cn } from "@/lib/utils"

/*
 * Anti-cheat camera checks, all on the candidate's device:
 *  - face in view, a second person, looking away (head turn and eye direction)
 *  - a phone in view
 *  - leaving the interview tab or window
 * No video is recorded or uploaded. Only counts are sent to /api/interviews/[id]/integrity.
 */

// Keep the version in step with @mediapipe/tasks-vision in package.json.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm"
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
const OBJECT_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite"

const TICK_MS = 250
const PHONE_EVERY = 6 // ticks (~1.5s)
const REPORT_MS = 15_000
const CALIBRATION_SAMPLES = 8

/** How long a problem must last before it counts (ms). */
const MIN_MS: Record<IntegrityFlag, number> = {
  noFace: 3000,
  multipleFaces: 1500,
  lookingAway: 3000,
  phone: 2000, // two phone checks in a row
  tabAway: 1500,
}

export type ProctorStatus = "off" | "starting" | "on" | "blocked" | "unavailable"
export type ProctorWarning = Exclude<IntegrityFlag, "tabAway"> | null

const WARNING_TEXT: Record<Exclude<ProctorWarning, null>, { short: string; long: string }> = {
  noFace: { short: "Can't see you", long: "We can't see your face. Stay in front of the camera." },
  multipleFaces: { short: "2+ people", long: "Someone else is in view. Only you should be in the interview." },
  lookingAway: { short: "Look here", long: "Please look at the screen while you answer." },
  phone: { short: "Phone seen", long: "A phone is in view. Put it away until the interview ends." },
}

type Detectors = { face: FaceLandmarker; phone: ObjectDetector | null }

let detectorsPromise: Promise<Detectors> | null = null

/** Loads the MediaPipe models once per page (about 20 MB, cached by the browser after the first time). */
function loadDetectors() {
  detectorsPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision")
    const files = await FilesetResolver.forVisionTasks(WASM_URL)
    const face = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })
    const phone = (delegate: "GPU" | "CPU") =>
      ObjectDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: OBJECT_MODEL, delegate },
        runningMode: "VIDEO",
        scoreThreshold: 0.45,
        maxResults: 3,
        categoryAllowlist: ["cell phone"],
      })
    const faceTask = await face("GPU").catch(() => face("CPU"))
    // Phone detection is a bonus: the face checks still run without it.
    const phoneTask = await phone("GPU")
      .catch(() => phone("CPU"))
      .catch(() => null)
    return { face: faceTask, phone: phoneTask }
  })().catch((error) => {
    detectorsPromise = null
    throw error
  })
  return detectorsPromise
}

const DEG = 180 / Math.PI
const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

/** Head turn (yaw) and nod (pitch) in degrees, from the 4x4 face transform (column-major). */
function headPose(matrix: Matrix | undefined) {
  const m = matrix?.data
  if (!m || m.length < 16) return null
  return { yaw: Math.atan2(-m[2], Math.hypot(m[6], m[10])) * DEG, pitch: Math.atan2(m[6], m[10]) * DEG }
}

/** How far the eyes look to the side and down (0-1), from the face blendshapes. */
function eyeGaze(shapes: Classifications | undefined) {
  const score = (name: string) => shapes?.categories.find((c) => c.categoryName === name)?.score ?? 0
  const left = (score("eyeLookOutLeft") + score("eyeLookInRight")) / 2
  const right = (score("eyeLookInLeft") + score("eyeLookOutRight")) / 2
  return { side: Math.max(left, right), down: (score("eyeLookDownLeft") + score("eyeLookDownRight")) / 2 }
}

type Episode = { since: number | null; counted: boolean }

/** The counts for one browser session. Plain mutable state, kept outside React renders. */
class IntegrityTracker {
  readonly id = crypto.randomUUID()
  readonly session = emptyIntegritySession()
  dirty = false
  private episodes = Object.fromEntries(
    (["noFace", "multipleFaces", "lookingAway", "phone", "tabAway"] as const).map((f) => [f, { since: null, counted: false }]),
  ) as Record<IntegrityFlag, Episode>

  /** Counts a problem once it has lasted long enough; adds its duration when it ends. Returns whether it counts now. */
  track(flag: IntegrityFlag, active: boolean, now = performance.now()) {
    const e = this.episodes[flag]
    if (active) {
      e.since ??= now
      if (!e.counted && now - e.since >= MIN_MS[flag]) {
        e.counted = true
        this.session.flags[flag].count++
        this.dirty = true
      }
    } else if (e.since !== null) {
      if (e.counted) this.session.flags[flag].ms += now - e.since
      e.since = null
      e.counted = false
    }
    return e.counted
  }

  time(ms: number, inView: boolean) {
    this.session.monitoredMs += ms
    if (inView) this.session.inViewMs += ms
    this.dirty = true
  }

  setCamera(camera: CameraState) {
    this.session.camera = camera
    this.dirty = true
  }

  notePaste() {
    this.session.pastes++
    this.dirty = true
  }

  /** What gets saved: the session with problems that are still going on included. */
  body() {
    const now = performance.now()
    const copy: IntegritySession = structuredClone(this.session)
    for (const [flag, e] of Object.entries(this.episodes) as [IntegrityFlag, Episode][]) {
      if (e.counted && e.since !== null) copy.flags[flag].ms += now - e.since
    }
    for (const f of Object.values(copy.flags)) f.ms = Math.round(f.ms)
    copy.monitoredMs = Math.round(copy.monitoredMs)
    copy.inViewMs = Math.round(copy.inViewMs)
    copy.updatedAt = new Date().toISOString()
    return JSON.stringify({ sessionId: this.id, session: copy })
  }
}

export function useProctor({ interviewId, mode }: { interviewId: string; mode: "voice" | "text" }) {
  const video = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<ProctorStatus>("off")
  const [warning, setWarning] = useState<ProctorWarning>(null)

  const tracker = useRef<IntegrityTracker | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const loop = useRef<ReturnType<typeof setInterval> | null>(null)
  const run = useRef(0) // bumps on every start/stop so stale async work can bail out

  // Created on first use (in the browser), not during render.
  const getTracker = useCallback(() => (tracker.current ??= new IntegrityTracker()), [])

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    video.current = el
  }, [])

  const url = `/api/interviews/${interviewId}/integrity`

  const flush = useCallback(async () => {
    const t = tracker.current
    if (!t) return
    t.dirty = false
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: t.body(), keepalive: true }).catch(() => {
      t.dirty = true
    })
  }, [url])

  const stopCamera = useCallback(() => {
    run.current++
    if (loop.current) clearInterval(loop.current)
    loop.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    setWarning(null)
  }, [])

  const runChecks = useCallback(
    async (myRun: number, t: IntegrityTracker) => {
      let detectors: Detectors
      try {
        detectors = await loadDetectors()
      } catch (error) {
        console.warn("[proctor] couldn't load the face checks", error)
        if (myRun !== run.current) return
        stopCamera()
        t.setCamera("unavailable")
        setStatus("unavailable")
        void flush()
        return
      }
      if (myRun !== run.current) return
      t.setCamera("on")
      setStatus("on")

      const calibration: { yaw: number[]; pitch: number[]; down: number[] } = { yaw: [], pitch: [], down: [] }
      let base: { yaw: number; pitch: number; down: number } | null = null
      let last = performance.now()
      let ticks = 0
      let phoneSeen = false

      loop.current = setInterval(() => {
        const v = video.current
        if (myRun !== run.current || !v || v.readyState < 2 || v.videoWidth === 0) return
        const now = performance.now()
        const dt = Math.min(now - last, 1000)
        last = now
        ticks++

        let faces = 0
        let away = false
        try {
          const result = detectors.face.detectForVideo(v, now)
          faces = result.faceLandmarks.length
          if (faces === 1) {
            const pose = headPose(result.facialTransformationMatrixes[0])
            const gaze = eyeGaze(result.faceBlendshapes[0])
            if (pose && !base) {
              // Learn the candidate's normal "looking at the screen" angle first (webcams sit at different heights).
              calibration.yaw.push(pose.yaw)
              calibration.pitch.push(pose.pitch)
              calibration.down.push(gaze.down)
              if (calibration.yaw.length >= CALIBRATION_SAMPLES) {
                base = { yaw: median(calibration.yaw), pitch: median(calibration.pitch), down: median(calibration.down) }
              }
            } else if (pose && base) {
              const turned = angleDiff(pose.yaw, base.yaw) > 30
              // Looking down is normal while typing, so only voice interviews check it.
              const nodded = mode === "voice" && angleDiff(pose.pitch, base.pitch) > 25
              const eyesAside = gaze.side > 0.65
              const eyesDown = mode === "voice" && gaze.down > 0.55 && gaze.down - base.down > 0.35
              away = turned || nodded || eyesAside || eyesDown
            }
          }
          if (detectors.phone && ticks % PHONE_EVERY === 0) {
            phoneSeen = detectors.phone.detectForVideo(v, now).detections.length > 0
          }
        } catch (error) {
          console.warn("[proctor] check failed", error)
          return
        }

        t.time(dt, faces === 1 && !away)
        const shown: ProctorWarning[] = []
        if (t.track("multipleFaces", faces > 1, now)) shown.push("multipleFaces")
        if (t.track("phone", phoneSeen, now)) shown.push("phone")
        if (t.track("noFace", faces === 0, now)) shown.push("noFace")
        if (t.track("lookingAway", faces === 1 && away, now)) shown.push("lookingAway")
        const next = shown[0] ?? null
        setWarning((current) => (current === next ? current : next))
      }, TICK_MS)
    },
    [flush, mode, stopCamera],
  )

  /** Turns the camera on. Resolves once it's allowed or refused; the checks start when the models are loaded. */
  const start = useCallback(async () => {
    if (stream.current) return
    const t = getTracker()
    const myRun = ++run.current
    setStatus("starting")

    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      })
    } catch (error) {
      if (myRun !== run.current) return
      const blocked = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
      const camera: CameraState = blocked ? "blocked" : "unavailable"
      t.setCamera(camera)
      setStatus(camera)
      void flush()
      return
    }
    if (myRun !== run.current) return media.getTracks().forEach((track) => track.stop())
    stream.current = media
    if (video.current) {
      video.current.srcObject = media
      await video.current.play().catch(() => {})
    }
    void runChecks(myRun, t)
  }, [flush, getTracker, runChecks])

  /** Camera off and counts saved (call before building the report). */
  const stop = useCallback(async () => {
    stopCamera()
    setStatus((s) => (s === "on" || s === "starting" ? "off" : s))
    await flush()
  }, [flush, stopCamera])

  const notePaste = useCallback(() => getTracker().notePaste(), [getTracker])

  // Leaving the tab or the browser window counts (switching to notes, another AI tool, etc.),
  // with or without a camera.
  useEffect(() => {
    const t = tracker.current
    if (status === "off" || !t) return
    let wasAway = false
    const check = () => {
      const away = document.visibilityState === "hidden" || !document.hasFocus()
      if (t.track("tabAway", away)) wasAway = true
      if (!away && wasAway) {
        wasAway = false
        toast.warning("You left the interview window. This shows in your report.")
      }
    }
    const timer = setInterval(check, 500)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("blur", check)
    window.addEventListener("focus", check)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("blur", check)
      window.removeEventListener("focus", check)
    }
  }, [status])

  // Send the counts every few seconds while something changed, and when the page closes.
  useEffect(() => {
    const timer = setInterval(() => tracker.current?.dirty && void flush(), REPORT_MS)
    const onHide = () => {
      const t = tracker.current
      if (t) navigator.sendBeacon?.(url, new Blob([t.body()], { type: "application/json" }))
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      clearInterval(timer)
      window.removeEventListener("pagehide", onHide)
    }
  }, [flush, url])

  // Turn the camera off when leaving the room.
  useEffect(
    () => () => {
      if (stream.current) void flush()
      stopCamera()
    },
    [flush, stopCamera],
  )

  return { attachVideo, status, warning, start, stop, flush, notePaste }
}

export type Proctor = ReturnType<typeof useProctor>

/** Downloads the face models in the background so the camera check starts instantly. */
export function preloadProctor() {
  void loadDetectors().catch(() => {})
}

/** Small self-view in the corner of the interviewer card, with the current check result. */
export function ProctorCam({ proctor, className }: { proctor: Proctor; className?: string }) {
  const { status, warning, attachVideo } = proctor
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    attachVideo(videoRef.current)
    return () => attachVideo(null)
  }, [attachVideo])
  const off = status === "blocked" || status === "unavailable"
  return (
    <div
      className={cn(
        "w-20 overflow-hidden rounded-xl bg-black/50 text-left ring-1 ring-white/15 backdrop-blur transition-shadow sm:w-36",
        warning && "ring-2 ring-amber-400",
        status === "off" && "hidden",
        className,
      )}
      data-testid="proctor-cam"
      data-status={status}
      data-warning={warning ?? ""}
    >
      <div className="relative aspect-[4/3] bg-black/40">
        {/* Mirrored like a normal selfie view. Detection uses the unmirrored frames. */}
        <video ref={videoRef} muted playsInline aria-label="Your camera" className={cn("size-full -scale-x-100 object-cover", off && "invisible")} />
        {status === "starting" && (
          <span className="absolute right-1.5 bottom-1.5 text-white/80">
            <Loader2Icon className="size-3.5 animate-spin" />
          </span>
        )}
        {off && (
          <span className="absolute inset-0 grid place-items-center text-white/60">
            <CameraOffIcon className="size-5" />
          </span>
        )}
      </div>
      <p className="flex items-center gap-1 truncate px-2 py-1 text-[10px] font-medium text-white/80 sm:text-[11px]" aria-live="polite">
        {status === "on" && !warning && (
          <>
            <ShieldCheckIcon className="size-3 shrink-0 text-emerald-300" />
            In view
          </>
        )}
        {status === "on" && warning && <span className="truncate text-amber-300">{WARNING_TEXT[warning].short}</span>}
        {status === "starting" && "Starting checks…"}
        {off && <span className="text-amber-300">Camera off</span>}
      </p>
    </div>
  )
}

/** One-line explanation under the question when a check fails, or when the camera is off. */
export function ProctorNotice({ proctor, className }: { proctor: Proctor; className?: string }) {
  const { status, warning } = proctor
  if (status === "on" && warning) {
    return (
      <p role="alert" className={cn("mx-auto w-fit rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-200", className)}>
        {WARNING_TEXT[warning].long}
      </p>
    )
  }
  if (status === "blocked" || status === "unavailable") {
    return (
      <p role="alert" className={cn("mx-auto flex w-fit flex-wrap items-center justify-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-200", className)}>
        {status === "blocked"
          ? "Camera is blocked, so this interview will be marked “Not verified”."
          : "Camera checks couldn't start, so this interview will be marked “Not verified”."}
        <button type="button" onClick={() => void proctor.start()} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          <RotateCcwIcon className="size-3" /> Try again
        </button>
      </p>
    )
  }
  return null
}
