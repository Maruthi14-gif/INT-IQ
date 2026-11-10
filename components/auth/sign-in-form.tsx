"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { ArrowLeftIcon, BriefcaseBusinessIcon, Loader2Icon, MailCheckIcon, type LucideIcon, UserRoundIcon } from "lucide-react"
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
import { friendlyAuthError, runAuth } from "@/lib/auth/errors"
import type { UserRole } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 30

/** Only allow same-site relative redirects. */
function safeNext(value: string | null) {
  // An explicit same-site `next` (for example, a protected page the visitor
  // opened) is still honored.
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

const ROLE_OPTIONS: { role: UserRole; title: string; description: string; icon: LucideIcon }[] = [
  {
    role: "student",
    title: "Candidate",
    description: "Practice interviews and apply to jobs",
    icon: UserRoundIcon,
  },
  {
    role: "recruiter",
    title: "Recruiter",
    description: "Post jobs and interview candidates",
    icon: BriefcaseBusinessIcon,
  },
]

export function SignInForm() {
  const router = useRouter()

  const [step, setStep] = useState<"email" | "otp">("email")
  const [role, setRole] = useState<UserRole | null>(null)
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
    if (!(await saveRoleIntent())) {
      setSending(false)
      return false
    }
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
    if (!role) {
      setError("Choose a workspace before continuing.")
      return
    }
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
    if (!(await saveRoleIntent())) {
      setVerifying(false)
      return
    }
    const result = await runAuth(() => authClient.signIn.emailOtp({ email, otp: code }))
    if (!result.ok) {
      setVerifying(false)
      setOtp("")
      setError(result.message)
      shake.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.45 } })
      return
    }
    try {
      const completion = await fetch(`/api/auth/complete?next=${encodeURIComponent(nextPath())}`, { method: "POST" })
      const data = await completion.json().catch(() => ({}))
      if (completion.status === 409) {
        router.replace("/auth/role-conflict")
        router.refresh()
        return
      }
      if (!completion.ok) throw new Error(data.error ?? "Couldn't finish signing in.")
      router.replace(data.next)
      router.refresh()
    } catch (e) {
      setVerifying(false)
      setError(e instanceof Error ? e.message : "Couldn't finish signing in.")
    }
  }

  async function saveRoleIntent() {
    if (!role) {
      setError("Choose a workspace before continuing.")
      return false
    }
    try {
      const response = await fetch("/api/auth/role-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Couldn't save your workspace choice.")
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your workspace choice.")
      return false
    }
  }

  async function continueWithGoogle() {
    setGoogleLoading(true)
    setError(null)
    if (!(await saveRoleIntent())) {
      setGoogleLoading(false)
      return
    }
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: absoluteUrl(`/api/auth/complete?next=${encodeURIComponent(nextPath())}`),
        errorCallbackURL: absoluteUrl("/sign-in"),
        disableRedirect: true,
      })
      if (result.error) throw result.error
      if (!result.data?.url) throw new Error("Google sign-in didn't return an authorization URL.")
      const authorizationUrl = new URL(result.data.url)
      if (
        authorizationUrl.protocol !== "https:" ||
        !authorizationUrl.hostname.includes(".neonauth.") ||
        !authorizationUrl.hostname.endsWith(".aws.neon.tech") ||
        !authorizationUrl.pathname.endsWith("/auth/sign-in/social/init")
      ) {
        throw new Error("Google sign-in returned an invalid authorization URL.")
      }
      window.location.assign(authorizationUrl.toString())
    } catch (error) {
      setGoogleLoading(false)
      toast.error(friendlyAuthError(error))
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
          className="space-y-5"
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-medium">Choose your workspace</h1>
            <p className="text-sm text-muted-foreground">Select how you&rsquo;ll use INT-IQ. This choice is saved to your account.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose your workspace">
            {ROLE_OPTIONS.map(({ role: optionRole, title, description, icon: Icon }) => (
              <motion.button
                key={optionRole}
                type="button"
                role="radio"
                aria-checked={role === optionRole}
                onClick={() => {
                  setRole(optionRole)
                  setError(null)
                }}
                whileTap={{ scale: 0.985 }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  role === optionRole ? "border-brand bg-brand-soft/60 ring-3 ring-brand/20" : "bg-card hover:bg-accent/50",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", role === optionRole ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                </span>
              </motion.button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-3 text-[15px]"
            onClick={continueWithGoogle}
            disabled={!role || googleLoading}
          >
            {googleLoading ? <Loader2Icon className="animate-spin" /> : <GoogleIcon className="size-[18px]" />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "email-error" : undefined}
                className="h-11 px-3.5 text-[15px] md:text-[15px]"
              />
              {error && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="h-11 w-full text-[15px]" disabled={!role || sending}>
              {sending && <Loader2Icon className="animate-spin" />}
              Continue with email
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">We&rsquo;ll email you a 6-digit code to sign in.</p>
        </motion.div>
      ) : (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-5"
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
            <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
              <MailCheckIcon className="size-6" />
            </span>
            <h1 className="text-2xl font-medium">Check your email</h1>
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
            className="h-11 w-full text-[15px]"
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
