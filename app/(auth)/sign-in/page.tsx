import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { LampRoom } from "@/components/auth/lamp-room"
import { SignInForm } from "@/components/auth/sign-in-form"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession, homeFor } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign in",
}

export default function SignInPage() {
  return (
    <LampRoom>
      {/* Static: part of the prerendered page, so it shows instantly. */}
      <SignInForm />
      {/* Request-time check that can't hold up the form. */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </LampRoom>
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
