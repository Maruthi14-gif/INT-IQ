"use client"

import { motion, useAnimationFrame, useInView, useMotionTemplate, useMotionValue } from "motion/react"
import Link from "next/link"
import { useRef, type ComponentProps, type ReactNode } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A spark of amber light that keeps running around a button's edge.
 * Adapted from "Moving Border" by Aceternity UI (ui.aceternity.com): rebuilt as a Next.js
 * link, typed, recolored, still for reduced motion and paused while off screen.
 */

export function MovingBorder({
  children,
  duration = 3000,
  rx,
  ry,
}: {
  children: ReactNode
  /** Milliseconds for one lap. */
  duration?: number
  rx?: string
  ry?: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rectRef = useRef<SVGRectElement>(null)
  const inView = useInView(svgRef)
  const calm = usePrefersReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useAnimationFrame((time) => {
    if (calm || !inView) return
    const rect = rectRef.current
    const length = rect?.getTotalLength()
    if (!rect || !length) return
    const point = rect.getPointAtLength((time * (length / duration)) % length)
    x.set(point.x)
    y.set(point.y)
  })

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
        <rect ref={rectRef} fill="none" width="100%" height="100%" rx={rx} ry={ry} />
      </svg>
      <motion.span className="absolute top-0 left-0 inline-block" style={{ transform }}>
        {children}
      </motion.span>
    </>
  )
}

/** A link styled as a button, with the running spark around it. Style the face with `className`. */
export function MovingBorderLink({
  children,
  className,
  containerClassName,
  duration = 3200,
  radius = "0.75rem",
  ...props
}: ComponentProps<typeof Link> & {
  containerClassName?: string
  duration?: number
  radius?: string
}) {
  return (
    <Link
      className={cn(
        "relative inline-flex overflow-hidden p-[2px] outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        containerClassName,
      )}
      style={{ borderRadius: radius }}
      {...props}
    >
      <span aria-hidden className="absolute inset-0" style={{ borderRadius: `calc(${radius} * 0.96)` }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <span className="block size-20 bg-[radial-gradient(var(--brand)_40%,transparent_60%)] opacity-90" />
        </MovingBorder>
      </span>
      <span
        className={cn("relative inline-flex h-full w-full items-center justify-center gap-2 font-medium transition-colors", className)}
        style={{ borderRadius: `calc(${radius} * 0.96)` }}
      >
        {children}
      </span>
    </Link>
  )
}
