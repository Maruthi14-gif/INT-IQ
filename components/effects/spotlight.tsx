"use client"

import { motion } from "motion/react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * Two slow, swaying cones of warm light from the top corners, behind a page header.
 * Place it inside a `relative` box; it clips itself. Colors come from --spot-1/2/3 in
 * globals.css (stronger in light mode so the warmth still shows on white).
 * Adapted from "Spotlight New" by Aceternity UI (ui.aceternity.com).
 */
export function Spotlight({
  className,
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 7,
  xOffset = 100,
}: {
  className?: string
  translateY?: number
  width?: number
  height?: number
  smallWidth?: number
  duration?: number
  xOffset?: number
}) {
  const calm = usePrefersReducedMotion()
  const sway = (dir: 1 | -1) =>
    calm
      ? { x: 0 }
      : { x: [0, dir * xOffset, 0], transition: { duration, repeat: Infinity, repeatType: "reverse" as const, ease: "easeInOut" as const } }

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <motion.div initial={{ x: 0 }} animate={sway(1)} className="absolute top-0 left-0 h-screen w-screen">
        <div
          className="absolute top-0 left-0"
          style={{ transform: `translateY(${translateY}px) rotate(-45deg)`, background: "var(--spot-1)", width, height }}
        />
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: "rotate(-45deg) translate(5%, -50%)", background: "var(--spot-2)", width: smallWidth, height }}
        />
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: "rotate(-45deg) translate(-180%, -70%)", background: "var(--spot-3)", width: smallWidth, height }}
        />
      </motion.div>
      <motion.div initial={{ x: 0 }} animate={sway(-1)} className="absolute top-0 right-0 h-screen w-screen">
        <div
          className="absolute top-0 right-0"
          style={{ transform: `translateY(${translateY}px) rotate(45deg)`, background: "var(--spot-1)", width, height }}
        />
        <div
          className="absolute top-0 right-0 origin-top-right"
          style={{ transform: "rotate(45deg) translate(-5%, -50%)", background: "var(--spot-2)", width: smallWidth, height }}
        />
        <div
          className="absolute top-0 right-0 origin-top-right"
          style={{ transform: "rotate(45deg) translate(180%, -70%)", background: "var(--spot-3)", width: smallWidth, height }}
        />
      </motion.div>
    </motion.div>
  )
}
