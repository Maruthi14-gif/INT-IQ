"use client"

import { motion, stagger, useAnimate } from "motion/react"
import { useEffect } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"

/*
 * Words that fade in from a blur, one after another. Renders inline, so it can sit
 * inside a heading and keep the heading's own size and weight.
 * Adapted from "Text Generate Effect" by Aceternity UI (ui.aceternity.com).
 */
export function TextGenerateEffect({
  text,
  className,
  duration = 0.5,
  blur = true,
}: {
  text: string
  className?: string
  duration?: number
  blur?: boolean
}) {
  const [scope, animate] = useAnimate()
  const calm = usePrefersReducedMotion()
  const words = text.split(" ")

  useEffect(() => {
    animate(
      "span",
      { opacity: 1, filter: blur ? "blur(0px)" : "none" },
      { duration: calm ? 0 : duration, delay: calm ? 0 : stagger(0.12) },
    )
  }, [animate, blur, calm, duration])

  return (
    <span ref={scope} className={className}>
      {words.map((word, i) => (
        <motion.span key={`${word}-${i}`} className="opacity-0" style={{ filter: blur ? "blur(10px)" : "none" }}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  )
}
