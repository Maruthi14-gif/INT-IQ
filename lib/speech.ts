"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

/* Browser speech APIs: speechSynthesis (interviewer voice) and SpeechRecognition (live captions).
 * Recognition works in Chrome and Edge; elsewhere the user types. */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const noopSubscribe = () => () => {}

/** True in browsers with speech recognition (false during server render). */
export function useRecognitionSupported() {
  return useSyncExternalStore(noopSubscribe, () => Boolean(recognitionCtor()), () => false)
}

/* ── Interviewer voice ───────────────────────────────────────── */

const VOICE_PREFERENCES = [/Neerja.*Natural/i, /Natural/i, /Google UK English Female/i, /Google US English/i, /en-IN/i]

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"))
  for (const pref of VOICE_PREFERENCES) {
    const match = english.find((v) => pref.test(`${v.name} ${v.lang}`))
    if (match) return match
  }
  return english[0] ?? null
}

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const voice = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (!("speechSynthesis" in window)) return
    const choose = () => {
      voice.current = pickVoice(window.speechSynthesis.getVoices())
    }
    choose()
    window.speechSynthesis.addEventListener("voiceschanged", choose)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", choose)
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!("speechSynthesis" in window)) {
      onDone?.()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (voice.current) utterance.voice = voice.current
    utterance.rate = 1
    utterance.onstart = () => {
      setBlocked(false)
      setSpeaking(true)
    }
    utterance.onend = () => {
      setSpeaking(false)
      onDone?.()
    }
    utterance.onerror = (e) => {
      setSpeaking(false)
      // Browsers block audio until the user has interacted with the page.
      if (e.error === "not-allowed") setBlocked(true)
      else if (e.error !== "interrupted" && e.error !== "canceled") onDone?.()
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { speaking, blocked, speak, stop }
}

/* ── Live captions ───────────────────────────────────────────── */

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [micBlocked, setMicBlocked] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const wanted = useRef(false)
  const committed = useRef("")
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  })

  const start = useCallback((existingText: string) => {
    const Ctor = recognitionCtor()
    if (!Ctor) return false
    recognition.current?.abort()
    committed.current = existingText.trim()
    const rec = new Ctor()
    rec.lang = "en-IN"
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript.trim()
        if (!piece) continue
        if (e.results[i].isFinal) committed.current = `${committed.current} ${piece}`.trim()
        else interim = `${interim} ${piece}`.trim()
      }
      onTextRef.current(`${committed.current} ${interim}`.trim())
    }
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        wanted.current = false
        setMicBlocked(true)
      }
    }
    rec.onend = () => {
      // Chrome stops after a pause; keep listening until the user stops.
      if (wanted.current) {
        try {
          rec.start()
          return
        } catch {
          /* fall through */
        }
      }
      setListening(false)
    }
    wanted.current = true
    recognition.current = rec
    try {
      rec.start()
      setMicBlocked(false)
      setListening(true)
      return true
    } catch {
      return false
    }
  }, [])

  const stop = useCallback(() => {
    wanted.current = false
    recognition.current?.stop()
    setListening(false)
  }, [])

  useEffect(() => () => {
    wanted.current = false
    recognition.current?.abort()
  }, [])

  return { listening, micBlocked, start, stop }
}
