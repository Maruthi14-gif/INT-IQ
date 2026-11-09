/**
 * Anti-cheat ("integrity") checks during an interview.
 *
 * The camera is analysed in the browser (MediaPipe face and phone detection). No video
 * is recorded or uploaded: only these counts are saved with the interview, one entry
 * per browser session (a reconnect or page reload starts a new one).
 */

export const INTEGRITY_FLAGS = ["noFace", "multipleFaces", "lookingAway", "phone", "tabAway"] as const
export type IntegrityFlag = (typeof INTEGRITY_FLAGS)[number]

export type CameraState = "on" | "off" | "blocked" | "unavailable"

export type IntegritySession = {
  startedAt: string
  updatedAt: string
  camera: CameraState
  /** Time the camera was checking. */
  monitoredMs: number
  /** Time exactly one face was in view and facing the screen. */
  inViewMs: number
  flags: Record<IntegrityFlag, { count: number; ms: number }>
  /** Paste attempts in the answer box (text mode blocks pasting). */
  pastes: number
}

export type IntegrityLog = { sessions: Record<string, IntegritySession> }

export type IntegrityLevel = "clean" | "minor" | "review" | "unverified"

export const INTEGRITY_LEVEL: Record<IntegrityLevel, string> = {
  clean: "No concerns",
  minor: "A few flags",
  review: "Needs review",
  unverified: "Not verified",
}

export function emptyIntegritySession(now = new Date()): IntegritySession {
  return {
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    camera: "off",
    monitoredMs: 0,
    inViewMs: 0,
    flags: Object.fromEntries(INTEGRITY_FLAGS.map((f) => [f, { count: 0, ms: 0 }])) as IntegritySession["flags"],
    pastes: 0,
  }
}

/** All sessions of one interview added up, plus an overall verdict. */
export function summarizeIntegrity(log: IntegrityLog | null | undefined) {
  const sessions = Object.values(log?.sessions ?? {})
  if (sessions.length === 0) return null

  const total = emptyIntegritySession()
  for (const s of sessions) {
    total.monitoredMs += s.monitoredMs
    total.inViewMs += s.inViewMs
    total.pastes += s.pastes
    for (const f of INTEGRITY_FLAGS) {
      total.flags[f].count += s.flags[f]?.count ?? 0
      total.flags[f].ms += s.flags[f]?.ms ?? 0
    }
  }

  const cameraUsed = total.monitoredMs > 0
  const inViewPercent = cameraUsed ? Math.round((total.inViewMs / total.monitoredMs) * 100) : null
  const { noFace, multipleFaces, lookingAway, phone, tabAway } = total.flags
  // Another person, a phone, leaving the tab and pasting weigh more than a glance away.
  const points = noFace.count + lookingAway.count + 2 * (multipleFaces.count + phone.count + tabAway.count + total.pastes)

  const level: IntegrityLevel = !cameraUsed
    ? "unverified"
    : points >= 5 || multipleFaces.count + phone.count >= 2 || (inViewPercent ?? 100) < 60
      ? "review"
      : points <= 1 && (inViewPercent ?? 100) >= 85
        ? "clean"
        : "minor"

  return { ...total, cameraUsed, inViewPercent, level, label: INTEGRITY_LEVEL[level] }
}

export type IntegritySummary = NonNullable<ReturnType<typeof summarizeIntegrity>>
