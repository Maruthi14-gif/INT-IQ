"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A thick, slowly shifting amber-to-ember border with a soft glow behind it. Use it for
 * the one thing on a page that needs attention, like a recruiter's invitation. Only the
 * sharp border moves; the blurred glow under it stays still, since a moving blur repaints.
 * Adapted from "Background Gradient" by Aceternity UI (ui.aceternity.com), recolored.
 */

const COLORS =
  "bg-[radial-gradient(circle_farthest-side_at_0_100%,var(--brand),transparent),radial-gradient(circle_farthest-side_at_100%_0,var(--color-ember),transparent),radial-gradient(circle_farthest-side_at_100%_100%,var(--color-brand-light),transparent),radial-gradient(circle_farthest-side_at_0_0,var(--color-ember-deep),var(--color-stage))]"

export function BackgroundGradient({
  children,
  className,
  containerClassName,
}: {
  children?: ReactNode
  className?: string
  containerClassName?: string
}) {
  const calm = usePrefersReducedMotion()
  const motionProps = {
    initial: { backgroundPosition: "0% 50%" },
    animate: calm ? { backgroundPosition: "0% 50%" } : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] },
    transition: calm ? { duration: 0 } : { duration: 6, repeat: Infinity, repeatType: "reverse" as const },
    style: { backgroundSize: "400% 400%" },
  }

  return (
    <div className={cn("group relative rounded-[calc(var(--radius-2xl)+3px)] p-[3px]", containerClassName)}>
      <div
        aria-hidden
        style={{ backgroundSize: "400% 400%", backgroundPosition: "0% 50%" }}
        className={cn("absolute inset-0 z-[1] rounded-[inherit] opacity-50 blur-xl transition-opacity duration-500 group-hover:opacity-90", COLORS)}
      />
      <motion.div aria-hidden {...motionProps} className={cn("absolute inset-0 z-[1] rounded-[inherit]", COLORS)} />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  )
}
