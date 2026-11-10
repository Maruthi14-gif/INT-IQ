"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { useEffect, useState, type ComponentProps } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A button whose 1px edge has a highlight circling it; on hover the whole edge lights amber.
 * Adapted from "Hover Border Gradient" by Aceternity UI (ui.aceternity.com): rebuilt as a
 * Next.js link and themed with the app tokens, so it works in light and dark.
 */

// Literal brand amber (#f2b544) here: motion tweens between these strings and can't read var().
type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT"
const ORDER: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"]

const MOVING: Record<Direction, string> = {
  TOP: "radial-gradient(20.7% 50% at 50% 0%, #f2b544 0%, rgba(242, 181, 68, 0) 100%)",
  LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, #f2b544 0%, rgba(242, 181, 68, 0) 100%)",
  BOTTOM: "radial-gradient(20.7% 50% at 50% 100%, #f2b544 0%, rgba(242, 181, 68, 0) 100%)",
  RIGHT: "radial-gradient(16.2% 41.2% at 100% 50%, #f2b544 0%, rgba(242, 181, 68, 0) 100%)",
}
const HIGHLIGHT = "radial-gradient(75% 181.16% at 50% 50%, #f2b544 0%, rgba(242, 181, 68, 0) 100%)"

export function HoverBorderGradientLink({
  children,
  className,
  containerClassName,
  duration = 1,
  clockwise = true,
  ...props
}: ComponentProps<typeof Link> & {
  containerClassName?: string
  /** Seconds per quarter turn. */
  duration?: number
  clockwise?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [direction, setDirection] = useState<Direction>("TOP")
  const calm = usePrefersReducedMotion()

  useEffect(() => {
    if (hovered || calm) return
    const timer = setInterval(() => {
      setDirection((d) => {
        const i = ORDER.indexOf(d)
        return ORDER[clockwise ? (i - 1 + ORDER.length) % ORDER.length : (i + 1) % ORDER.length]
      })
    }, duration * 1000)
    return () => clearInterval(timer)
  }, [hovered, calm, duration, clockwise])

  return (
    <Link
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit items-center justify-center overflow-visible rounded-xl bg-foreground/10 p-px outline-none transition duration-500 focus-visible:ring-3 focus-visible:ring-ring/60",
        containerClassName,
      )}
      {...props}
    >
      <span className={cn("z-10 inline-flex items-center gap-2 rounded-[inherit] bg-primary px-4 py-2 font-medium text-primary-foreground", className)}>
        {children}
      </span>
      <motion.span
        aria-hidden
        className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        style={{ filter: "blur(2px)" }}
        initial={{ background: MOVING[direction] }}
        animate={{ background: hovered ? [MOVING[direction], HIGHLIGHT] : MOVING[direction] }}
        transition={{ ease: "linear", duration }}
      />
      <span aria-hidden className="absolute inset-[2px] z-[1] rounded-[inherit] bg-primary" />
    </Link>
  )
}
