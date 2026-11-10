"use client"

import { animate, type AnimationPlaybackControls } from "motion/react"
import { memo, useEffect, useRef, type CSSProperties } from "react"
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

/*
 * A border that lights up in amber on the side nearest the pointer. Put it inside a
 * `relative` card with a border radius; it fills the card and follows its corners.
 * Adapted from "Glowing Effect" by Aceternity UI (ui.aceternity.com), recolored to the
 * INT-IQ amber. It stays off on touch screens and for reduced motion.
 *
 * All cards on a page share one pointer listener and one frame: every card is measured
 * first, then updated, so the browser lays out once per frame however many cards there are.
 */

const GRADIENT = `radial-gradient(circle, var(--brand) 10%, transparent 20%),
  radial-gradient(circle at 40% 40%, var(--color-brand-light) 5%, transparent 15%),
  radial-gradient(circle at 60% 60%, var(--color-ember) 10%, transparent 20%),
  radial-gradient(circle at 40% 60%, var(--color-brand-light) 10%, transparent 20%),
  repeating-conic-gradient(
    from 236.84deg at 50% 50%,
    var(--brand) 0%,
    var(--color-brand-light) calc(25% / var(--repeating-conic-gradient-times)),
    var(--color-ember) calc(50% / var(--repeating-conic-gradient-times)),
    var(--color-brand-light) calc(75% / var(--repeating-conic-gradient-times)),
    var(--brand) calc(100% / var(--repeating-conic-gradient-times))
  )`

type Glow = {
  el: HTMLDivElement
  inactiveZone: number
  proximity: number
  movementDuration: number
  angle: number
  active: boolean
  anim?: AnimationPlaybackControls
}

/* ── one shared pointer loop for every glowing card ── */
const glows = new Set<Glow>()
let pointer: { x: number; y: number } | null = null
let frame = 0

function setActive(g: Glow, active: boolean) {
  if (g.active === active) return
  g.active = active
  g.el.style.setProperty("--active", active ? "1" : "0")
}

function update(g: Glow, rect: DOMRect, x: number, y: number) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const inactiveRadius = 0.5 * Math.min(rect.width, rect.height) * g.inactiveZone
  if (Math.hypot(x - cx, y - cy) < inactiveRadius) return setActive(g, false)

  const p = g.proximity
  const inside = x > rect.left - p && x < rect.right + p && y > rect.top - p && y < rect.bottom + p
  setActive(g, inside)
  if (!inside) return

  const target = (180 * Math.atan2(y - cy, x - cx)) / Math.PI + 90
  const diff = ((target - g.angle + 180) % 360) - 180
  g.anim?.stop()
  g.anim = animate(g.angle, g.angle + diff, {
    duration: g.movementDuration,
    ease: [0.16, 1, 0.3, 1],
    onUpdate: (v) => {
      g.angle = v
      g.el.style.setProperty("--start", String(v))
    },
  })
}

function schedule() {
  if (frame || !pointer) return
  frame = requestAnimationFrame(() => {
    frame = 0
    if (!pointer) return
    const { x, y } = pointer
    const measured = [...glows].map((g) => [g, g.el.getBoundingClientRect()] as const)
    for (const [g, rect] of measured) update(g, rect, x, y)
  })
}
const onPointerMove = (e: PointerEvent) => {
  pointer = { x: e.clientX, y: e.clientY }
  schedule()
}

function register(g: Glow) {
  glows.add(g)
  if (glows.size === 1) {
    document.body.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("scroll", schedule, { passive: true })
  }
  return () => {
    g.anim?.stop()
    glows.delete(g)
    if (glows.size === 0) {
      document.body.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("scroll", schedule)
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}

type GlowingEffectProps = {
  /** Blur of the glow in px. */
  blur?: number
  /** Share of the card's middle (0 to 1) where the glow switches off. */
  inactiveZone?: number
  /** How far outside the card (px) the pointer still lights it. */
  proximity?: number
  /** Width of the lit arc in degrees. */
  spread?: number
  className?: string
  disabled?: boolean
  movementDuration?: number
  borderWidth?: number
}

export const GlowingEffect = memo(function GlowingEffect({
  blur = 0,
  inactiveZone = 0.01,
  proximity = 64,
  spread = 40,
  className,
  movementDuration = 2,
  borderWidth = 2,
  disabled = false,
}: GlowingEffectProps) {
  const ref = useRef<HTMLDivElement>(null)
  const calm = usePrefersReducedMotion()
  const fine = useFinePointer()
  const off = disabled || calm || !fine

  useEffect(() => {
    const el = ref.current
    if (off || !el) return
    return register({ el, inactiveZone, proximity, movementDuration, angle: 0, active: false })
  }, [off, inactiveZone, proximity, movementDuration])

  return (
    <div
      ref={ref}
      aria-hidden
      style={
        {
          "--blur": `${blur}px`,
          "--spread": spread,
          "--start": "0",
          "--active": "0",
          "--glowingeffect-border-width": `${borderWidth}px`,
          "--repeating-conic-gradient-times": "5",
          "--gradient": GRADIENT,
        } as CSSProperties
      }
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", blur > 0 && "blur-[var(--blur)]", className)}
    >
      <div
        className={cn(
          "rounded-[inherit]",
          'after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))] after:rounded-[inherit] after:content-[""]',
          "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
          "after:[background:var(--gradient)] after:[background-attachment:fixed]",
          "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
          "after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect]",
          "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
        )}
      />
    </div>
  )
})
