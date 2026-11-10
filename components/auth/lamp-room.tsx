"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"
import "./lamp-room.css"

/*
 * The sign-in "lamp room": a dark room with a desk lamp. Pulling the lamp's cord lights
 * the room and slides the sign-in card in. Adapted from "Animated Lamp Login" by
 * saklincodes (MIT, see THIRD_PARTY_NOTICES.md).
 *
 * Kept simple to use: a click or Enter on the cord also works, the choice is remembered
 * on this device, and people who prefer reduced motion get the lit room straight away.
 */

const LAMP_KEY = "intiq-lamp"
const SOUND_KEY = "intiq-lamp-sound"
const STRING_LENGTH = 95
const MOTES = 12

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode: the lamp just won't be remembered */
  }
}

/* Short synthesized clicks, so there are no audio files to load. */
function useLampSound(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null)
  return useCallback(
    (kind: "pull" | "on" | "off") => {
      if (!enabled) return
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      ctx.current ??= new Ctor()
      const ac = ctx.current
      if (ac.state === "suspended") void ac.resume()
      const now = ac.currentTime
      const blip = (type: OscillatorType, from: number, to: number, gain: number, length: number) => {
        const osc = ac.createOscillator()
        const amp = ac.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(from, now)
        osc.frequency.exponentialRampToValueAtTime(to, now + length)
        amp.gain.setValueAtTime(gain, now)
        amp.gain.exponentialRampToValueAtTime(0.001, now + length)
        osc.connect(amp).connect(ac.destination)
        osc.start(now)
        osc.stop(now + length)
      }
      if (kind === "pull") blip("triangle", 320, 140, 0.15, 0.05)
      else if (kind === "on") {
        blip("square", 1200, 300, 0.22, 0.07)
        blip("sine", 120, 110, 0.08, 0.25)
      } else blip("square", 700, 200, 0.22, 0.07)
    },
    [enabled],
  )
}

export function LampRoom({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false)
  const [sound, setSound] = useState(true)
  const play = useLampSound(sound)

  const handleRef = useRef<HTMLButtonElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const motesRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0, moved: false })
  const spring = useRef(0)
  const calm = useRef(false) // prefers reduced motion

  // Start lit for returning visitors and for reduced motion; remember the sound choice.
  useEffect(() => {
    calm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const remembered = read(LAMP_KEY) === "on"
    const quiet = read(SOUND_KEY) === "off"
    // Reading device preferences after mount keeps the server render identical.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (remembered || calm.current) setOn(true)
    if (quiet) setSound(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const setLamp = useCallback(
    (next: boolean) => {
      setOn(next)
      write(LAMP_KEY, next ? "on" : "off")
      play(next ? "on" : "off")
    },
    [play],
  )

  /* ── cord ── */
  const drawString = (x: number, y: number) => {
    pathRef.current?.setAttribute("d", `M 0 0 Q ${x * 0.3} ${(STRING_LENGTH + y) * 0.5} ${x} ${STRING_LENGTH + y}`)
    if (handleRef.current) handleRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  const release = (fromX: number, fromY: number) => {
    cancelAnimationFrame(spring.current)
    if (calm.current) return drawString(0, 0)
    let x = fromX
    let y = fromY
    let vx = 0
    let vy = 0
    const step = () => {
      vx = (vx - 0.16 * x) * 0.78
      vy = (vy - 0.16 * y) * 0.78
      x += vx
      y += vy
      drawString(x, y)
      if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1 || Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) spring.current = requestAnimationFrame(step)
      else drawString(0, 0)
    }
    spring.current = requestAnimationFrame(step)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    cancelAnimationFrame(spring.current)
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, x: 0, y: 0, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.dataset.dragging = "true"
    play("pull")
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d.active) return
    d.x = Math.max(-40, Math.min(40, (e.clientX - d.startX) * 0.35))
    d.y = Math.min(180, Math.max(0, e.clientY - d.startY) * 0.75)
    if (Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4) d.moved = true
    drawString(d.x, d.y)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    e.currentTarget.dataset.dragging = "false"
    // A real pull, or a plain tap on the bead, both switch the lamp.
    if (d.y > 35 || !d.moved) {
      setLamp(!on)
      release(d.moved ? d.x : 0, d.moved ? d.y : 45)
    } else {
      release(d.x, d.y)
    }
  }
  // Keyboard (Enter/Space) arrives as a click with no pointer details.
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0) return
    setLamp(!on)
    release(0, 45)
  }

  /* ── lamp head follows the mouse a little; the card catches a spotlight ── */
  useEffect(() => {
    if (calm.current || !window.matchMedia("(pointer: fine)").matches) return
    let frame = 0
    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    const tick = () => {
      frame = 0
      const nx = (mx / window.innerWidth - 0.5) * 2
      if (headRef.current) headRef.current.style.transform = `rotate(${nx * 4.5}deg) skewX(${nx * 2}deg)`
      if (beamRef.current) beamRef.current.style.transform = `translate3d(${nx * 12}px, 0, 0) rotate(${nx * 3.15}deg)`
      const card = cardRef.current?.getBoundingClientRect()
      if (card && cardRef.current) {
        cardRef.current.style.setProperty("--mouse-x", `${((mx - card.left) / card.width) * 100}%`)
        cardRef.current.style.setProperty("--mouse-y", `${((my - card.top) / card.height) * 100}%`)
      }
    }
    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      frame ||= requestAnimationFrame(tick)
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  /* ── dust motes while the light is on ── */
  useEffect(() => {
    const box = motesRef.current
    if (!box) return
    box.replaceChildren()
    if (!on || calm.current) return
    for (let i = 0; i < MOTES; i++) {
      const dot = document.createElement("span")
      dot.className = "lamp-mote"
      const size = Math.random() * 3 + 2
      dot.style.width = dot.style.height = `${size}px`
      dot.style.setProperty("--duration", `${Math.random() * 20 + 20}s`)
      dot.style.setProperty("--delay", `-${Math.random() * 15}s`)
      for (let n = 1; n <= 4; n++) {
        dot.style.setProperty(`--x${n}`, `${Math.random() * 100}vw`)
        dot.style.setProperty(`--y${n}`, `${Math.random() * 100}vh`)
      }
      box.appendChild(dot)
    }
  }, [on])

  useEffect(() => () => cancelAnimationFrame(spring.current), [])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    write(SOUND_KEY, next ? "on" : "off")
  }

  return (
    <div className={cn("dark lamp-room", on && "is-on")}>
      <div className="lamp-window" aria-hidden>
        <div className="lamp-stars" />
      </div>
      <div className="lamp-room-light" aria-hidden />
      <div className="lamp-motes" ref={motesRef} aria-hidden />

      <header className="lamp-top">
        <Logo />
        <button
          type="button"
          className="lamp-sound"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Mute lamp sounds" : "Turn on lamp sounds"}
        >
          {sound ? <Volume2Icon className="size-[18px]" /> : <VolumeXIcon className="size-[18px]" />}
        </button>
      </header>

      <section className="lamp-side" aria-label="Desk lamp">
        <div className="lamp">
          <div className="lamp-glow" aria-hidden />
          <div className="lamp-finial" aria-hidden />
          <div className="lamp-head" ref={headRef} aria-hidden>
            <div className="lamp-bulb" />
          </div>
          <div className="lamp-beam" ref={beamRef} aria-hidden />
          <div className="lamp-neck" aria-hidden />
          <div className="lamp-stem" aria-hidden />
          <div className="lamp-joint" aria-hidden />
          <div className="lamp-base" aria-hidden />
          <div className="lamp-desk" aria-hidden />

          <svg className="lamp-string" aria-hidden>
            <path ref={pathRef} d={`M 0 0 L 0 ${STRING_LENGTH}`} />
          </svg>
          <button
            ref={handleRef}
            type="button"
            className="lamp-handle"
            aria-label={on ? "Pull the lamp cord to switch the light off" : "Pull the lamp cord to sign in"}
            aria-pressed={on}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onClick}
          />
          <p className="lamp-hint" aria-hidden>
            Pull the cord to sign in
          </p>
        </div>
      </section>

      <section className="lamp-login">
        {/* Hidden from keyboard and screen readers until the light is on. */}
        <div className="lamp-card" ref={cardRef} inert={!on} data-testid="lamp-card">
          <div className="lamp-card-spot" aria-hidden />
          <div className="lamp-card-line" aria-hidden />
          <div className="lamp-card-body">{children}</div>
        </div>
      </section>
    </div>
  )
}
