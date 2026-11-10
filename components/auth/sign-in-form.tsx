"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { ArrowLeftIcon, Loader2Icon, MailCheckIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { GoogleIcon } from "@/components/brand/google-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth/client"
import { runAuth } from "@/lib/auth/errors"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 30

/** Only allow same-site relative redirects. */
function safeNext(value: string | null) {
  if (!value) return "/dashboard"
  try {
    // Resolve against this origin: anything that lands elsewhere (like "/\t/evil.com") is refused.
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/")) return "/dashboard"
    return url.pathname + url.search + url.hash
  } catch {
    return "/dashboard"
  }
}

/**
 * Where to go after signing in. Read from the URL only when needed (not with
 * useSearchParams), so the form stays fully static and loads instantly.
 */
function nextPath() {
  const params = new URLSearchParams(window.location.search)
  return safeNext(params.get("next") ?? params.get("redirectTo"))
}

/** Neon Auth redirects to absolute URLs, so resolve paths against this origin. */
function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).toString()
}

const slotClass =
  "size-12 rounded-xl border bg-background text-xl font-medium first:rounded-xl last:rounded-xl dark:bg-input/30 sm:size-14"

export function SignInForm() {
  const router = useRouter()

  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const shake = useAnimationControls()
  const shownOAuthError = useRef(false)

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Error coming back from Google (Neon Auth adds ?error=...)
  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get("error")
    if (oauthError && !shownOAuthError.current) {
      shownOAuthError.current = true
      toast.error("Google sign-in didn't complete. Please try again.")
    }
  }, [])

  async function requestCode(address: string) {
    setSending(true)
    const result = await runAuth(() => authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" }))
    setSending(false)
    if (!result.ok) {
      setError(result.message)
      return false
    }
    setCooldown(RESEND_SECONDS)
    return true
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const address = email.trim().toLowerCase()
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address.")
      return
    }
    if (await requestCode(address)) {
      setEmail(address)
      setOtp("")
      setStep("otp")
    }
  }

  async function resend() {
    setError(null)
    setOtp("")
    if (await requestCode(email)) toast.success(`New code sent to ${email}`)
  }

  async function verify(code: string) {
    if (code.length !== 6 || verifying) return
    setVerifying(true)
    setError(null)
    const result = await runAuth(() => authClient.signIn.emailOtp({ email, otp: code }))
    if (!result.ok) {
      setVerifying(false)
      setOtp("")
      setError(result.message)
      shake.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.45 } })
      return
    }
    // Keep the spinner while we navigate.
    router.replace(nextPath())
    router.refresh()
  }

  async function continueWithGoogle() {
    setGoogleLoading(true)
    const result = await runAuth(() =>
      authClient.signIn.social({
        provider: "google",
        callbackURL: absoluteUrl(nextPath()),
        errorCallbackURL: absoluteUrl("/sign-in"),
      }),
    )
    if (!result.ok) {
      setGoogleLoading(false)
      toast.error(result.message)
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === "email" ? (
        <motion.div
          key="email"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-7"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to INT-IQ</h1>
            <p className="text-muted-foreground">Sign in or create your account. No password needed.</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-3 text-[15px]"
            onClick={continueWithGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? <Loader2Icon className="animate-spin" /> : <GoogleIcon className="size-[18px]" />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs tracking-wider text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onEmailSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "email-error" : undefined}
                className="h-12 px-3.5 text-[15px] md:text-[15px]"
              />
              {error && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="h-12 w-full text-[15px]" disabled={sending}>
              {sending && <Loader2Icon className="animate-spin" />}
              Continue with email
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">We&rsquo;ll email you a 6-digit code to sign in.</p>
        </motion.div>
      ) : (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-7"
        >
          <button
            type="button"
            onClick={() => {
              setStep("email")
              setError(null)
            }}
            className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Use a different email
          </button>

          <div className="space-y-3">
            <span className="grid size-12 place-items-center rounded-2xl border bg-brand-soft text-brand-text">
              <MailCheckIcon className="size-6" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground">
              Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <motion.div animate={shake}>
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              value={otp}
              onChange={(value) => {
                setOtp(value)
                setError(null)
              }}
              onComplete={verify}
              autoFocus
              disabled={verifying}
              aria-label="6-digit code"
              containerClassName="justify-between gap-2"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slotClass} aria-invalid={Boolean(error)} />
                ))}
              </InputOTPGroup>
              <span className="h-px w-3 bg-border" aria-hidden />
              <InputOTPGroup className="gap-2">
                {[3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slotClass} aria-invalid={Boolean(error)} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </motion.div>

          {error && (
            <p role="alert" className="-mt-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="h-12 w-full text-[15px]"
            onClick={() => verify(otp)}
            disabled={otp.length !== 6 || verifying}
          >
            {verifying && <Loader2Icon className="animate-spin" />}
            {verifying ? "Signing you in…" : "Verify and continue"}
          </Button>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Can&rsquo;t find it? Check spam.</span>
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || sending}
              className="font-medium text-brand-text transition-opacity hover:opacity-80 disabled:cursor-default disabled:text-muted-foreground disabled:opacity-100"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
