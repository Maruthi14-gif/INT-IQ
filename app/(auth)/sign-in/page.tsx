import { CheckIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SignInForm } from "@/components/auth/sign-in-form"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession, homeFor } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign in",
}

const PERKS = [
  "Voice interviews built from your resume",
  "A score and a stronger answer for every question",
  "Recruiters invite candidates and read the reports",
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
      <div className="m-3 hidden rounded-2xl bg-stage text-stage-foreground lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-md px-10">
          {/* The product's own moment: a follow-up that picks up a detail from the answer. */}
          <div className="space-y-5 rounded-xl bg-stage-raised p-5 ring-1 ring-white/10">
            <div>
              <p className="text-xs text-white/50">You</p>
              <p className="mt-1 text-[15px] leading-7 text-white/70">
                I split the placement portal into a Next.js front end and a{" "}
                <mark className="highlight bg-transparent text-white">Node API with a job queue</mark> for resume parsing.
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">
                Interviewer <span className="ml-2 text-brand">follow-up</span>
              </p>
              <p className="mt-1 text-[15px] leading-7">Why a queue there, and what happened when a parse failed halfway?</p>
            </div>
          </div>

          <h2 className="mt-10 text-3xl font-medium text-balance">Practice the interview before it counts</h2>

          <ul className="mt-6 space-y-3 text-sm text-white/70">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <CheckIcon className="size-4 shrink-0 text-white/50" strokeWidth={1.5} />
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
