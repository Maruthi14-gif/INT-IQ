import { CheckIcon, MicIcon, PhoneOffIcon, TrendingUpIcon, VideoIcon } from "lucide-react"
import { VoiceBars, VoiceOrb } from "@/components/brand/voice-orb"

const SCORES = [
  { label: "Clarity", value: 85 },
  { label: "Structure", value: 78 },
  { label: "Depth", value: 64 },
]

/** Static product preview of the interview room, used on the landing page. */
export function InterviewPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* glow under the card */}
      <div className="absolute inset-x-10 -bottom-6 top-10 -z-10 rounded-[2rem] bg-indigo-500/25 blur-3xl dark:bg-indigo-500/20" />

      <div className="overflow-hidden rounded-2xl border bg-card/80 shadow-2xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl dark:shadow-black/40 dark:ring-white/5">
        {/* top bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3 text-xs sm:px-5">
          <span className="inline-flex items-center gap-1.5 font-medium text-red-500">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            LIVE
          </span>
          <span className="truncate text-muted-foreground">
            Frontend Developer <span className="mx-1 text-border">/</span> Technical round
          </span>
          <span className="ml-auto hidden text-muted-foreground sm:inline">Question 3 of 8</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono tabular-nums text-foreground">12:48</span>
        </div>

        <div className="grid md:grid-cols-[1fr_280px]">
          {/* stage */}
          <div className="relative flex flex-col items-center gap-6 px-5 pt-10 pb-6 sm:px-10">
            <div className="absolute inset-0 -z-10 bg-glow opacity-60" />
            <VoiceOrb />
            <div className="text-center">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">AI interviewer · speaking</p>
              <p className="mt-3 max-w-md text-balance text-base leading-relaxed sm:text-lg">
                &ldquo;Nice, you mentioned memoization. When could{" "}
                <span className="rounded bg-brand-soft px-1 font-mono text-[0.9em] text-brand-text">useMemo</span> actually
                make performance worse?&rdquo;
              </p>
            </div>

            <div className="mt-2 flex w-full items-end justify-between gap-4">
              {/* candidate tile */}
              <div className="relative hidden h-20 w-32 overflow-hidden rounded-xl border bg-linear-to-br from-slate-200 to-slate-300 sm:block dark:from-slate-700 dark:to-slate-800">
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/40 px-2 py-1 text-[10px] text-white">
                  You
                  <VoiceBars className="h-2.5 text-emerald-300" bars={4} />
                </div>
              </div>

              {/* controls */}
              <div className="mx-auto flex items-center gap-2 sm:mx-0">
                <span className="grid size-10 place-items-center rounded-full border bg-background">
                  <MicIcon className="size-4" />
                </span>
                <span className="grid size-10 place-items-center rounded-full border bg-background">
                  <VideoIcon className="size-4" />
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-red-500 text-white">
                  <PhoneOffIcon className="size-4" />
                </span>
              </div>
              <div className="hidden w-32 sm:block" />
            </div>
          </div>

          {/* feedback rail */}
          <aside className="border-t bg-muted/30 p-5 md:border-t-0 md:border-l">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Live feedback</p>
            <ul className="mt-4 space-y-3.5">
              {SCORES.map((s) => (
                <li key={s.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{s.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${s.value}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-2 text-sm">
              <p className="flex gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                Used a concrete example from your project
              </p>
              <p className="flex gap-2">
                <TrendingUpIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                Mention the trade-offs before the fix
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
