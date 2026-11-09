import { cn } from "@/lib/utils"

/**
 * Animated "AI interviewer" orb. Pure CSS, so it works in Server Components.
 * Later the interview room will drive its scale from live audio levels.
 */
export function VoiceOrb({ className, speaking = true }: { className?: string; speaking?: boolean }) {
  return (
    <div className={cn("relative grid size-28 place-items-center", className)} aria-hidden>
      {speaking && (
        <>
          <span className="absolute inset-0 animate-orb-ring rounded-full border border-indigo-400/40" />
          <span className="absolute inset-0 animate-orb-ring rounded-full border border-indigo-400/30 [animation-delay:1.4s]" />
        </>
      )}
      <span
        className={cn(
          "absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_30%_25%,#c7d2fe_0%,#818cf8_35%,#4f46e5_70%,#312e81_100%)] shadow-[0_0_60px_-8px_rgb(99_102_241/0.7),inset_0_-8px_20px_rgb(30_27_75/0.5)]",
          speaking && "animate-orb-breathe",
        )}
      />
      <span className="absolute inset-[24%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.55),transparent_55%)]" />
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
