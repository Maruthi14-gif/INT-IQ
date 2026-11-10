import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Logo } from "@/components/brand/logo"
import { RoleConflictActions } from "@/components/auth/role-conflict-actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { homeFor, requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Account workspace" }

export default function RoleConflictPage() {
  return (
    <Suspense fallback={<main className="grid min-h-svh place-items-center p-5"><Skeleton className="h-72 w-full max-w-lg rounded-2xl" /></main>}>
      <RoleConflict />
    </Suspense>
  )
}

async function RoleConflict() {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  const currentRole = profile.role === "recruiter" ? "Recruiter" : "Candidate"

  return (
    <main className="flex min-h-svh flex-col px-5 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <section className="mx-auto my-auto w-full max-w-lg space-y-6 rounded-2xl border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <span className="text-xl font-semibold">!</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-medium">This account already has a workspace</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This account is set up as a {currentRole}. We kept its existing role. To use another workspace, sign out and choose a different account or the matching role.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href={homeFor(profile.role)}>Continue as {currentRole}</Link></Button>
          <RoleConflictActions />
        </div>
      </section>
    </main>
  )
}
