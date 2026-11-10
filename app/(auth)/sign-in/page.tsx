import { CheckIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SignInForm } from "@/components/auth/sign-in-form"
import { Logo } from "@/components/brand/logo"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { ThemeToggle } from "@/components/theme-toggle"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession, homeFor } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign in",
}

const PERKS = [
  "Voice interviews built from your resume",
  "Feedback and a score for every answer",
  "A clear plan for what to practice next",
]

export default function SignInPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.05fr]">
      {/* form column */}
      <div className="flex flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="INT-IQ home" className="rounded-md">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[520px]">
            {/* Static: part of the prerendered page, so it shows instantly. */}
            <SignInForm />
            {/* Request-time check that can't hold up the form. */}
            <Suspense fallback={null}>
              <RedirectIfSignedIn />
            </Suspense>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Interview practice and hiring, together.</p>
      </div>

      {/* brand panel */}
      <div className="relative isolate m-3 hidden overflow-hidden rounded-3xl bg-[#0d0c1d] text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_30%,rgb(99_102_241/0.4),transparent_70%)]" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-30 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />

        <div className="flex max-w-md flex-col items-center px-10 text-center">
          <VoiceOrb className="size-36" />
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left backdrop-blur-md">
            <p className="text-[11px] font-medium tracking-wider text-white/50 uppercase">AI interviewer</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/90">
              &ldquo;Tell me about a project you&rsquo;re proud of, and one decision you&rsquo;d make differently now.&rdquo;
            </p>
          </div>

          <h2 className="mt-10 text-3xl font-semibold tracking-tight text-balance">
            Practice the interview <span className="font-display font-normal text-indigo-300 italic">before it counts.</span>
          </h2>

          <ul className="mt-8 space-y-3 text-left text-sm text-white/80">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-indigo-500/25 text-indigo-200">
                  <CheckIcon className="size-3" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** Already signed in? Go to the account's workspace. Renders nothing otherwise. */
async function RedirectIfSignedIn() {
  const session = await getSession()
  if (session) {
    const profile = await getOrCreateProfile(session.user.id)
    redirect(profile.roleChosen ? homeFor(profile.role) : "/welcome")
  }
  return null
}
