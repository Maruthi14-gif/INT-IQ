import { cn } from "@/lib/utils"

const HEIGHTS = [0.35, 0.6, 1, 0.6, 0.35]

/**
 * The interviewer's presence: a flat circle with voice bars. The bars move only while
 * the interviewer is speaking (a live state), and rest otherwise. Pure CSS, so it works
 * in Server Components. Kept as "VoiceOrb" so existing imports don't change.
 */
export function VoiceOrb({ className, speaking = false }: { className?: string; speaking?: boolean }) {
  return (
    <div
      className={cn(
        "relative grid size-28 place-items-center rounded-full bg-stage-raised ring-1 ring-white/10 transition-shadow duration-300",
        speaking && "ring-brand/50",
        className,
      )}
      aria-hidden
    >
      <span className="flex h-[34%] items-center gap-[7%]">
        {HEIGHTS.map((h, i) => (
          <span
            key={i}
            className={cn("w-1.5 origin-center rounded-full bg-brand", speaking && "animate-bar")}
            style={{ height: `${h * 100}%`, animationDelay: `${(i * 0.13) % 0.6}s`, opacity: speaking ? 1 : 0.55 }}
          />
        ))}
      </span>
    </div>
  )
}

/** Small equalizer bars used for "listening" states. */
export function VoiceBars({ className, bars = 5 }: { className?: string; bars?: number }) {
  return (
    <span className={cn("inline-flex h-4 items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-center animate-bar rounded-full bg-current"
          style={{ animationDelay: `${(i * 0.13) % 0.6}s` }}
        />
      ))}
    </span>
  )
}
