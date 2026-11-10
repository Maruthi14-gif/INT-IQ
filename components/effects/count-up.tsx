"use client"

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react"
import { useEffect, useRef } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"

/**
 * A number that counts up from zero the first time it scrolls into view. The server
 * renders the final number, so it reads correctly before scripts load and for screen
 * readers; reduced motion skips the count.
 */
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const calm = usePrefersReducedMotion()
  const count = useMotionValue(value)
  const text = useTransform(count, (v) => `${Math.round(v)}${suffix}`)

  useEffect(() => {
    if (!inView || calm || value === 0) {
      count.set(value)
      return
    }
    const controls = animate(count, value, { from: 0, duration: 1.2, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [inView, calm, value, count])

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  )
}
