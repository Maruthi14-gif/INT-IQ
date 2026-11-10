import type { Metadata } from "next"
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

export default function SignInPage() {
  return (
    <div className="flex min-h-svh flex-col px-5 py-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[520px]">
          {/* Static: part of the prerendered page, so it shows instantly. */}
          <SignInForm />
          {/* Request-time check that can't hold up the form. */}
          <Suspense fallback={null}>
            <RedirectIfSignedIn />
          </Suspense>
        </div>
      </main>
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
