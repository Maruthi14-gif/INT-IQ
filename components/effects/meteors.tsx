import { cn } from "@/lib/utils"

/*
 * Amber meteors streaking across a dark card. Put it inside a `relative overflow-hidden`
 * box. Delays and speeds are fixed per meteor, so server and browser markup match.
 * The animation (meteor keyframes) lives in globals.css and stops for reduced motion.
 * Adapted from "Meteors" by Aceternity UI (ui.aceternity.com).
 */
export function Meteors({ number = 16, className }: { number?: number; className?: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: number }, (_, i) => {
        // Spread the start points over 800px, centred, and stagger them.
        const left = i * (800 / number) - 400
        const delay = ((i * 7) % 10) / 2
        const duration = 5 + ((i * 3) % 6)
        return (
          <span
            key={i}
            className={cn(
              "absolute size-0.5 animate-meteor-effect rounded-full bg-brand shadow-[0_0_0_1px_#ffffff10]",
              "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-brand/80 before:to-transparent before:content-['']",
              className,
            )}
            style={{ top: -40, left, animationDelay: `${delay}s`, animationDuration: `${duration}s` }}
          />
        )
      })}
    </span>
  )
}
