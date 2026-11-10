"use client"

import { AnimatePresence, motion } from "motion/react"
import { useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react"
import { usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A list where an amber-edged highlight slides to the row under the pointer, or the row
 * that has keyboard focus. The rows themselves can be server-rendered <li> elements.
 * Based on "Card Hover Effect" by Aceternity UI (ui.aceternity.com), reworked for lists.
 */
export function HighlightList({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  const calm = usePrefersReducedMotion()

  const moveTo = (target: EventTarget) => {
    const row = (target as HTMLElement).closest?.("li[data-row]") as HTMLLIElement | null
    if (row && ref.current?.contains(row)) setBox({ top: row.offsetTop, height: row.offsetHeight })
  }

  return (
    <ul
      ref={ref}
      className={cn("relative isolate", className)}
      onPointerOver={(e: PointerEvent) => moveTo(e.target)}
      onPointerLeave={() => setBox(null)}
      onFocus={(e: FocusEvent) => moveTo(e.target)}
      onBlur={(e: FocusEvent) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setBox(null)
      }}
    >
      <AnimatePresence>
        {box && (
          <motion.li
            aria-hidden
            role="presentation"
            className="pointer-events-none absolute inset-x-2 -z-10 rounded-xl border-0 bg-brand-soft/70 ring-1 ring-brand/35 dark:bg-brand/[0.07]"
            initial={{ opacity: 0, top: box.top, height: box.height }}
            animate={{ opacity: 1, top: box.top, height: box.height }}
            exit={{ opacity: 0 }}
            transition={calm ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
      </AnimatePresence>
      {children}
    </ul>
  )
}
