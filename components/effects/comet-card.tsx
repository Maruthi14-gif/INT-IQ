"use client"

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react"
import { useRef, type MouseEvent, type ReactNode } from "react"
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A card that tilts toward the pointer in 3D, with a glare that follows it, like holding
 * a badge up to the light. Flat on touch screens and for reduced motion.
 * Adapted from "Comet Card" by Aceternity UI (ui.aceternity.com).
 */
export function CometCard({
  rotateDepth = 12,
  translateDepth = 14,
  className,
  children,
}: {
  rotateDepth?: number
  translateDepth?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const calm = usePrefersReducedMotion()
  const fine = useFinePointer()
  const live = fine && !calm

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x)
  const sy = useSpring(y)

  const rotateX = useTransform(sy, [-0.5, 0.5], [`-${rotateDepth}deg`, `${rotateDepth}deg`])
  const rotateY = useTransform(sx, [-0.5, 0.5], [`${rotateDepth}deg`, `-${rotateDepth}deg`])
  const translateX = useTransform(sx, [-0.5, 0.5], [`-${translateDepth}px`, `${translateDepth}px`])
  const translateY = useTransform(sy, [-0.5, 0.5], [`${translateDepth}px`, `-${translateDepth}px`])
  const glareX = useTransform(sx, [-0.5, 0.5], [0, 100])
  const glareY = useTransform(sy, [-0.5, 0.5], [0, 100])
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.9) 10%, rgba(255, 255, 255, 0.75) 20%, rgba(255, 255, 255, 0) 80%)`

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!live || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <div className={cn("perspective-distant transform-3d", className)}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          rotateX,
          rotateY,
          translateX,
          translateY,
          boxShadow: "0 32px 64px -24px rgba(0, 0, 0, 0.45), 0 16px 32px -16px rgba(0, 0, 0, 0.3)",
        }}
        initial={{ scale: 1, z: 0 }}
        whileHover={live ? { scale: 1.04, z: 50, transition: { duration: 0.2 } } : undefined}
        className="relative rounded-2xl"
      >
        {children}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 rounded-2xl mix-blend-overlay"
          style={{ background: glare, opacity: live ? 0.5 : 0 }}
        />
      </motion.div>
    </div>
  )
}
