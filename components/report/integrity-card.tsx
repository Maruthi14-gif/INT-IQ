import { CameraOffIcon, ShieldAlertIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { IntegritySummary } from "@/lib/integrity"
import { cn } from "@/lib/utils"

const TONE = {
  clean: { icon: ShieldCheckIcon, className: "text-success", badge: "border-success/30 bg-success/10 text-success" },
  minor: { icon: ShieldAlertIcon, className: "text-warning", badge: "border-warning/30 bg-warning/10 text-warning" },
  review: { icon: ShieldAlertIcon, className: "text-destructive", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
  unverified: { icon: CameraOffIcon, className: "text-muted-foreground", badge: "" },
} satisfies Record<IntegritySummary["level"], { icon: LucideIcon; className: string; badge: string }>

function seconds(ms: number) {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function times(n: number) {
  return n === 1 ? "1 time" : `${n} times`
}

/** Anti-cheat summary on the report: camera and tab checks from the interview. */
export function IntegrityCard({ summary, mode }: { summary: IntegritySummary | null; mode: "text" | "voice" }) {
  const level = summary?.level ?? "unverified"
  const tone = TONE[level]
  const Icon = tone.icon
  const f = summary?.flags

  const items = summary?.cameraUsed
    ? [
        { label: "Face in view", value: `${summary.inViewPercent ?? 0}%`, bad: (summary.inViewPercent ?? 100) < 85 },
        { label: "Looked away", value: times(f!.lookingAway.count), hint: f!.lookingAway.ms ? seconds(f!.lookingAway.ms) : null, bad: f!.lookingAway.count > 0 },
        { label: "Out of view", value: times(f!.noFace.count), hint: f!.noFace.ms ? seconds(f!.noFace.ms) : null, bad: f!.noFace.count > 0 },
        { label: "Another person", value: times(f!.multipleFaces.count), bad: f!.multipleFaces.count > 0 },
        { label: "Phone seen", value: times(f!.phone.count), bad: f!.phone.count > 0 },
        { label: "Left the window", value: times(f!.tabAway.count), hint: f!.tabAway.ms ? seconds(f!.tabAway.ms) : null, bad: f!.tabAway.count > 0 },
        ...(mode === "text" || summary.pastes > 0
          ? [{ label: "Paste attempts", value: String(summary.pastes), bad: summary.pastes > 0 }]
          : []),
      ]
    : []

  return (
    <section className="rounded-2xl border bg-card p-6" aria-labelledby="integrity-title" data-testid="integrity-card" data-level={level}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="integrity-title" className="flex items-center gap-2 font-medium">
          <Icon className={cn("size-4", tone.className)} /> Integrity check
        </h2>
        <Badge variant="outline" className={tone.badge}>
          {summary?.label ?? "Not verified"}
        </Badge>
      </div>

      {items.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-muted/50 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className={cn("mt-0.5 font-medium tabular-nums", item.bad && "text-warning")}>
                {item.value}
                {"hint" in item && item.hint && <span className="ml-1 text-xs font-normal text-muted-foreground">({item.hint})</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          The camera was off for this interview, so we couldn’t check that it was done without help.
          {summary && summary.flags.tabAway.count > 0 && ` The interview window was left ${times(summary.flags.tabAway.count)}.`}
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Checked on your device during the interview. No video was recorded or uploaded.
      </p>
    </section>
  )
}
