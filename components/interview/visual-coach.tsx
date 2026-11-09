"use client"

import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  Matrix,
  NormalizedLandmark,
  PoseLandmarker,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision"
import { CameraIcon, CameraOffIcon, Loader2Icon, ScanFaceIcon } from "lucide-react"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { VISUAL_COACH_PREFIX } from "@/lib/visual-coaching"
import type { InterviewCoaching } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export type VisualCoachCue = {
  code: VisualCueCode
  message: string
  label: string
}

export type VisualCoachHandle = {
  start: () => Promise<boolean>
  stop: () => void
  getSummary: () => NonNullable<InterviewCoaching["camera"]>
}

type Props = {
  active: boolean
  onCue: (cue: VisualCoachCue) => void
  className?: string
}

type CoachStatus = "off" | "requesting" | "loading" | "ready" | "blocked" | "error"
type VisualCueCode =
  | "no_person"
  | "multiple_people"
  | "face_obscured"
  | "eyes_closed"
  | "vertical_gaze"
  | "side_gaze"
  | "head_tilt"
  | "off_center"
  | "too_close"
  | "too_far"
  | "low_light"
  | "glare"
  | "leaning"
  | "excessive_movement"

type Condition = {
  code: VisualCueCode
  active: boolean
}

type ConditionState = {
  since: number | null
  reminders: number
}

type VisionModels = {
  face: FaceLandmarker
  pose: PoseLandmarker
}

type Calibration = {
  ready: boolean
  samples: number
  pitch: number
  yaw: number
  roll: number
  centerX: number
  centerY: number
}

type CameraMetrics = {
  analyzedMs: number
  visibleMs: number
  activeMs: Map<VisualCueCode, number>
  reminders: Map<VisualCueCode, number>
}

const MEDIAPIPE_VERSION = "1.2.2"
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
const ANALYSIS_INTERVAL_MS = 250
const GLOBAL_REMINDER_COOLDOWN_MS = 25_000
const MAX_REMINDERS_PER_ISSUE = 2
const CALIBRATION_SAMPLES = 12
const PRE_CALIBRATION_CODES = new Set<VisualCueCode>([
  "no_person",
  "multiple_people",
  "face_obscured",
  "too_close",
  "too_far",
  "low_light",
  "glare",
])

const RULES: Record<VisualCueCode, { durationMs: number; label: string; message: string }> = {
  no_person: {
    durationMs: 2_500,
    label: "No person visible",
    message: "Please remain visible in the camera frame.",
  },
  multiple_people: {
    durationMs: 1_500,
    label: "Multiple people detected",
    message: "Please make sure you are the only person visible during the interview.",
  },
  face_obscured: {
    durationMs: 3_000,
    label: "Face is not clearly visible",
    message: "Please make sure your face is clearly visible to the camera.",
  },
  eyes_closed: {
    durationMs: 2_000,
    label: "Eyes appear closed",
    message: "Please keep your eyes open and stay engaged with the interview.",
  },
  vertical_gaze: {
    durationMs: 4_500,
    label: "Looking up or down",
    message: "Try to keep your face level and your attention near the camera.",
  },
  side_gaze: {
    durationMs: 5_000,
    label: "Looking away from camera",
    message: "Try to keep your attention near the camera instead of looking to the side.",
  },
  head_tilt: {
    durationMs: 5_000,
    label: "Head is tilted",
    message: "Try to keep your head upright for a more professional posture.",
  },
  off_center: {
    durationMs: 5_000,
    label: "Move toward the center",
    message: "Please center yourself in the camera frame.",
  },
  too_close: {
    durationMs: 5_000,
    label: "Too close to camera",
    message: "Move slightly back so your face and shoulders fit comfortably in the frame.",
  },
  too_far: {
    durationMs: 5_000,
    label: "Too far from camera",
    message: "Move slightly closer so your face is easier to see.",
  },
  low_light: {
    durationMs: 6_000,
    label: "Lighting is too dark",
    message: "Your face looks quite dark. If possible, add some light in front of you.",
  },
  glare: {
    durationMs: 6_000,
    label: "Lighting is too bright",
    message: "There is strong glare on the camera. Try reducing the light behind or in front of you.",
  },
  leaning: {
    durationMs: 6_000,
    label: "Posture is leaning",
    message: "Try to sit upright and keep your shoulders balanced.",
  },
  excessive_movement: {
    durationMs: 6_000,
    label: "Frequent movement detected",
    message: "Try to remain a little steadier while answering.",
  },
}

let modelsPromise: Promise<VisionModels> | null = null

async function loadVisionModels() {
  if (modelsPromise) return modelsPromise
  modelsPromise = (async () => {
    const { FaceLandmarker, FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision")
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
    const create = async (delegate: "GPU" | "CPU") => {
      const [face, pose] = await Promise.all([
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 3,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        }),
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
          runningMode: "VIDEO",
          numPoses: 2,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        }),
      ])
      return { face, pose }
    }
    try {
      return await create("GPU")
    } catch (error) {
      console.warn("[visual-coach] GPU initialization failed; using CPU", error)
      return create("CPU")
    }
  })().catch((error) => {
    modelsPromise = null
    throw error
  })
  return modelsPromise
}

export const VisualCoach = forwardRef<VisualCoachHandle, Props>(function VisualCoach(
  { active, onCue, className },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestToken = useRef(0)
  const modelsRef = useRef<VisionModels | null>(null)
  const activeRef = useRef(active)
  const onCueRef = useRef(onCue)
  const conditionState = useRef(new Map<VisualCueCode, ConditionState>())
  const lastReminderAt = useRef(0)
  const previousFaceCenter = useRef<{ x: number; y: number } | null>(null)
  const movementAverage = useRef(0)
  const lastLightCheck = useRef(0)
  const lastBrightness = useRef(128)
  const calibration = useRef<Calibration>(emptyCalibration())
  const metrics = useRef<CameraMetrics>(emptyMetrics())
  const [status, setStatus] = useState<CoachStatus>("off")
  const [currentLabel, setCurrentLabel] = useState("Camera coaching is off")

  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    onCueRef.current = onCue
  }, [onCue])

  const stop = useCallback(() => {
    requestToken.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    conditionState.current.clear()
    previousFaceCenter.current = null
    movementAverage.current = 0
    setStatus("off")
    setCurrentLabel("Camera coaching is off")
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error")
      setCurrentLabel("Camera is not supported in this browser")
      return false
    }
    setStatus("requesting")
    setCurrentLabel("Allow camera access")
    const token = ++requestToken.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      if (token !== requestToken.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      calibration.current = emptyCalibration()
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setStatus("loading")
      setCurrentLabel("Loading visual coach")
      void loadVisionModels()
        .then((models) => {
          if (!streamRef.current) return
          modelsRef.current = models
          setStatus("ready")
          setCurrentLabel("Camera coaching active")
        })
        .catch((error) => {
          console.error("[visual-coach] could not load vision models", error)
          setStatus("error")
          setCurrentLabel("Visual coach could not load")
        })
      return true
    } catch (error) {
      console.warn("[visual-coach] camera permission failed", error)
      setStatus("blocked")
      setCurrentLabel("Camera access is blocked")
      return false
    }
  }, [])

  const getSummary = useCallback(() => {
    const measured = metrics.current
    return {
      calibrated: calibration.current.ready,
      analyzedSeconds: Math.round(measured.analyzedMs / 1_000),
      visiblePercent:
        measured.analyzedMs > 0 ? Math.round((measured.visibleMs / measured.analyzedMs) * 100) : 0,
      issues: [...measured.activeMs.entries()]
        .filter(([, duration]) => duration >= 1_000)
        .map(([code, duration]) => ({
          code,
          label: RULES[code].label,
          seconds: Math.round(duration / 1_000),
          reminders: measured.reminders.get(code) ?? 0,
        }))
        .sort((a, b) => b.seconds - a.seconds),
    }
  }, [])

  useImperativeHandle(ref, () => ({ start, stop, getSummary }), [getSummary, start, stop])

  useEffect(
    () => () => {
      requestToken.current += 1
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (status !== "ready") return
    let frame = 0
    let lastAnalysisAt = 0
    let cancelled = false

    const analyze = (now: number) => {
      if (cancelled) return
      frame = requestAnimationFrame(analyze)
      if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) return
      const video = videoRef.current
      const models = modelsRef.current
      if (!video || !models || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
      lastAnalysisAt = now
      try {
        const face = models.face.detectForVideo(video, now)
        const pose = models.pose.detectForVideo(video, now)
        const brightness = measureBrightness(video, canvasRef.current, now, lastLightCheck, lastBrightness)
        const calibrated = updateCalibration(face, brightness, calibration.current)
        const conditions = detectConditions(
          face,
          pose,
          brightness,
          previousFaceCenter,
          movementAverage,
          calibration.current,
        )
        const trackableConditions = calibrated
          ? conditions
          : conditions.filter((condition) => PRE_CALIBRATION_CODES.has(condition.code))
        updateMetrics(trackableConditions, metrics.current)
        if (!calibrated) {
          processConditions(trackableConditions, now)
          if (!trackableConditions.some((condition) => condition.active)) {
            setCurrentLabel(
              face.faceLandmarks.length === 1
                ? `Look at the camera · calibrating ${Math.round((calibration.current.samples / CALIBRATION_SAMPLES) * 100)}%`
                : "Center your face to calibrate",
            )
          }
          return
        }
        processConditions(conditions, now)
      } catch (error) {
        console.warn("[visual-coach] frame analysis failed", error)
      }
    }

    const processConditions = (conditions: Condition[], now: number) => {
      if (!activeRef.current) {
        for (const state of conditionState.current.values()) state.since = null
        setCurrentLabel("Camera coaching active")
        return
      }
      const firstActive = conditions.find((condition) => condition.active)
      setCurrentLabel(firstActive ? RULES[firstActive.code].label : "Camera coaching active")

      for (const condition of conditions) {
        const rule = RULES[condition.code]
        const state = conditionState.current.get(condition.code) ?? { since: null, reminders: 0 }
        conditionState.current.set(condition.code, state)
        if (!condition.active) {
          state.since = null
          continue
        }
        state.since ??= now
        const persisted = now - state.since >= rule.durationMs
        const cooledDown = now - lastReminderAt.current >= GLOBAL_REMINDER_COOLDOWN_MS
        if (!persisted || !cooledDown || state.reminders >= MAX_REMINDERS_PER_ISSUE) continue

        state.reminders += 1
        metrics.current.reminders.set(condition.code, (metrics.current.reminders.get(condition.code) ?? 0) + 1)
        lastReminderAt.current = now
        for (const tracked of conditionState.current.values()) tracked.since = now
        onCueRef.current({
          code: condition.code,
          label: rule.label,
          message: `${VISUAL_COACH_PREFIX} ${rule.message}`,
        })
        break
      }
    }

    frame = requestAnimationFrame(analyze)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [status])

  const running = status === "requesting" || status === "loading" || status === "ready"

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-xl", className)}>
      <div className="relative aspect-[4/3]">
        <video ref={videoRef} muted playsInline className={cn("size-full scale-x-[-1] object-cover", !running && "hidden")} />
        {!running && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center text-white/60">
            <CameraOffIcon className="size-6" />
            <span className="text-[11px]">Camera coach starts with the call</span>
          </div>
        )}
        {(status === "requesting" || status === "loading") && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <Loader2Icon className="size-6 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => void (running ? stop() : start())}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white/80 transition hover:bg-black/80"
          aria-label={running ? "Turn camera coaching off" : "Turn camera coaching on"}
        >
          {running ? <CameraIcon className="size-3.5" /> : <CameraOffIcon className="size-3.5" />}
        </button>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2 text-[10px] text-white/70">
        <ScanFaceIcon className={cn("size-3.5", status === "ready" && "text-emerald-300")} />
        <span className="truncate">{currentLabel}</span>
      </div>
      <canvas ref={canvasRef} width={32} height={18} className="hidden" />
    </div>
  )
})

function measureBrightness(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  now: number,
  lastCheck: { current: number },
  lastValue: { current: number },
) {
  if (!canvas || now - lastCheck.current < 1_000) return lastValue.current
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return lastValue.current
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let total = 0
  for (let i = 0; i < pixels.length; i += 4) total += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
  lastCheck.current = now
  lastValue.current = total / (pixels.length / 4)
  return lastValue.current
}

function detectConditions(
  face: FaceLandmarkerResult,
  pose: PoseLandmarkerResult,
  brightness: number,
  previousCenter: { current: { x: number; y: number } | null },
  movementAverage: { current: number },
  calibration: Calibration,
): Condition[] {
  const faceCount = face.faceLandmarks.length
  const poseCount = pose.landmarks.length
  const personCount = Math.max(faceCount, poseCount)
  const primaryFace = face.faceLandmarks[0]
  const primaryPose = pose.landmarks[0]
  const box = primaryFace ? landmarkBox(primaryFace) : null
  const rotation = face.facialTransformationMatrixes[0] ? matrixToEuler(face.facialTransformationMatrixes[0]) : null
  const blendshapes = new Map(
    (face.faceBlendshapes[0]?.categories ?? []).map((category) => [category.categoryName, category.score]),
  )
  const eyesClosed = (blendshapes.get("eyeBlinkLeft") ?? 0) > 0.65 && (blendshapes.get("eyeBlinkRight") ?? 0) > 0.65
  const eyesLookingSide = Math.max(
    ((blendshapes.get("eyeLookOutLeft") ?? 0) + (blendshapes.get("eyeLookInRight") ?? 0)) / 2,
    ((blendshapes.get("eyeLookInLeft") ?? 0) + (blendshapes.get("eyeLookOutRight") ?? 0)) / 2,
  ) > 0.52
  const eyesLookingVertical = Math.max(
    ((blendshapes.get("eyeLookUpLeft") ?? 0) + (blendshapes.get("eyeLookUpRight") ?? 0)) / 2,
    ((blendshapes.get("eyeLookDownLeft") ?? 0) + (blendshapes.get("eyeLookDownRight") ?? 0)) / 2,
  ) > 0.52

  if (box) {
    const movement = previousCenter.current
      ? Math.hypot(box.centerX - previousCenter.current.x, box.centerY - previousCenter.current.y)
      : 0
    movementAverage.current = movementAverage.current * 0.82 + movement * 0.18
    previousCenter.current = { x: box.centerX, y: box.centerY }
  } else {
    previousCenter.current = null
    movementAverage.current *= 0.8
  }

  const leaning = primaryPose ? isLeaning(primaryPose) : false
  return [
    { code: "no_person", active: personCount === 0 },
    { code: "multiple_people", active: personCount > 1 },
    { code: "face_obscured", active: faceCount === 0 && poseCount > 0 },
    { code: "eyes_closed", active: Boolean(primaryFace && eyesClosed) },
    {
      code: "vertical_gaze",
      active: Boolean(eyesLookingVertical || (rotation && Math.abs(rotation.pitch - calibration.pitch) > 18)),
    },
    {
      code: "side_gaze",
      active: Boolean(eyesLookingSide || (rotation && Math.abs(rotation.yaw - calibration.yaw) > 22)),
    },
    { code: "head_tilt", active: Boolean(rotation && Math.abs(rotation.roll - calibration.roll) > 15) },
    {
      code: "off_center",
      active: Boolean(
        box &&
          (Math.abs(box.centerX - calibration.centerX) > 0.2 || Math.abs(box.centerY - calibration.centerY) > 0.2),
      ),
    },
    { code: "too_close", active: Boolean(box && (box.width > 0.58 || box.height > 0.78)) },
    { code: "too_far", active: Boolean(box && box.width < 0.17) },
    { code: "low_light", active: brightness < 45 },
    { code: "glare", active: brightness > 225 },
    { code: "leaning", active: leaning },
    { code: "excessive_movement", active: movementAverage.current > 0.032 },
  ]
}

function emptyCalibration(): Calibration {
  return { ready: false, samples: 0, pitch: 0, yaw: 0, roll: 0, centerX: 0.5, centerY: 0.5 }
}

function emptyMetrics(): CameraMetrics {
  return { analyzedMs: 0, visibleMs: 0, activeMs: new Map(), reminders: new Map() }
}

function updateCalibration(face: FaceLandmarkerResult, brightness: number, state: Calibration) {
  if (state.ready) return true
  if (face.faceLandmarks.length !== 1 || brightness < 45 || brightness > 225) return false
  const box = landmarkBox(face.faceLandmarks[0])
  const rotation = face.facialTransformationMatrixes[0] ? matrixToEuler(face.facialTransformationMatrixes[0]) : null
  if (!rotation || box.width < 0.17 || box.width > 0.58) return false
  state.samples += 1
  state.pitch += rotation.pitch
  state.yaw += rotation.yaw
  state.roll += rotation.roll
  state.centerX += box.centerX
  state.centerY += box.centerY
  if (state.samples < CALIBRATION_SAMPLES) return false
  state.pitch /= state.samples
  state.yaw /= state.samples
  state.roll /= state.samples
  // center values start at 0.5 to keep the first sample from dominating a short baseline.
  state.centerX /= state.samples + 1
  state.centerY /= state.samples + 1
  state.ready = true
  return true
}

function updateMetrics(conditions: Condition[], metrics: CameraMetrics) {
  metrics.analyzedMs += ANALYSIS_INTERVAL_MS
  if (!conditions.some((condition) => condition.code === "no_person" && condition.active)) {
    metrics.visibleMs += ANALYSIS_INTERVAL_MS
  }
  for (const condition of conditions) {
    if (condition.active) {
      metrics.activeMs.set(
        condition.code,
        (metrics.activeMs.get(condition.code) ?? 0) + ANALYSIS_INTERVAL_MS,
      )
    }
  }
}

function landmarkBox(landmarks: NormalizedLandmark[]) {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const point of landmarks) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return {
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

function matrixToEuler(matrix: Matrix) {
  const value = matrix.data
  if (matrix.rows < 3 || matrix.columns < 3 || value.length < 11) return null
  const degrees = 180 / Math.PI
  return {
    pitch: Math.atan2(value[9], value[10]) * degrees,
    yaw: Math.asin(Math.max(-1, Math.min(1, -value[8]))) * degrees,
    roll: Math.atan2(value[4], value[0]) * degrees,
  }
}

function isLeaning(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[0]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  if (!nose || !leftShoulder || !rightShoulder) return false
  if ((leftShoulder.visibility ?? 0) < 0.55 || (rightShoulder.visibility ?? 0) < 0.55) return false
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x)
  if (shoulderWidth < 0.08) return false
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y)
  const sideLean = Math.abs(nose.x - shoulderCenterX) > shoulderWidth * 0.48
  return sideLean || shoulderTilt > shoulderWidth * 0.32
}
