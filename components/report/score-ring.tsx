import { cn } from "@/lib/utils"

export function scoreTone(score: number, max = 100) {
  const pct = score / max
  return pct >= 0.75 ? "text-success" : pct >= 0.5 ? "text-warning" : "text-destructive"
}

/** Circular score out of 100. */
export function ScoreRing({ score, className }: { score: number; className?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div className={cn("relative grid size-36 place-items-center", className)}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className={scoreTone(clamped)}
        />
      </svg>
      <div className="text-center">
        <span className="block text-4xl font-medium tabular-nums">{clamped}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </div>
    </div>
  )
}
