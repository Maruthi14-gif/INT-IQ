import type { InterviewCoaching } from "@/lib/db/schema"

export type DeliveryTracker = {
  words: number
  fillerWords: number
  longPauses: number
  speakingMs: number
  turnStartedAt: number | null
  lastTranscriptAt: number | null
  lastFinalText: string
  lastFinalAt: number
}

export function createDeliveryTracker(): DeliveryTracker {
  return {
    words: 0,
    fillerWords: 0,
    longPauses: 0,
    speakingMs: 0,
    turnStartedAt: null,
    lastTranscriptAt: null,
    lastFinalText: "",
    lastFinalAt: 0,
  }
}

export function recordUserTranscript(tracker: DeliveryTracker, text: string, final: boolean, now = Date.now()) {
  tracker.turnStartedAt ??= now
  if (
    tracker.lastTranscriptAt &&
    now - tracker.lastTranscriptAt >= 2_500 &&
    now - tracker.lastTranscriptAt <= 15_000
  ) {
    tracker.longPauses += 1
  }
  tracker.lastTranscriptAt = now
  if (!final) return

  const normalized = text.trim().toLowerCase()
  // Some providers repeat the same final segment. Do not double-count a quick duplicate.
  if (normalized === tracker.lastFinalText && now - tracker.lastFinalAt < 3_000) return
  tracker.lastFinalText = normalized
  tracker.lastFinalAt = now
  tracker.words += normalized.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  tracker.fillerWords += countFillers(normalized)
}

export function closeSpeakingTurn(tracker: DeliveryTracker, now = Date.now()) {
  if (tracker.turnStartedAt) tracker.speakingMs += Math.max(0, now - tracker.turnStartedAt)
  tracker.turnStartedAt = null
  tracker.lastTranscriptAt = null
}

export function deliverySummary(
  tracker: DeliveryTracker,
  now = Date.now(),
): NonNullable<InterviewCoaching["delivery"]> {
  const currentTurnMs = tracker.turnStartedAt ? Math.max(0, now - tracker.turnStartedAt) : 0
  const minutes = (tracker.speakingMs + currentTurnMs) / 60_000
  return {
    words: tracker.words,
    wordsPerMinute: tracker.words >= 10 && minutes > 0 ? Math.round(tracker.words / minutes) : null,
    fillerWords: tracker.fillerWords,
    longPauses: tracker.longPauses,
  }
}

function countFillers(text: string) {
  const matches = text.match(/\b(?:um+|uh+|erm+|hmm+|basically|actually|literally|you know)\b/gi)
  return matches?.length ?? 0
}
