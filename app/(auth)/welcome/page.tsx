import type { Metadata } from "next"
import { Suspense } from "react"
import { RoleChooser } from "@/components/auth/role-chooser"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { homeFor, requireUser } from "@/lib/session"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "Welcome" }

export default function WelcomePage() {
  return (
    <div className="flex min-h-svh flex-col px-5 py-5 sm:px-8">
      <Logo className="w-fit" />
      <div className="flex flex-1 items-center justify-center py-12">
        <Suspense fallback={<Skeleton className="h-80 w-full max-w-2xl rounded-2xl" />}>
          <Chooser />
        </Suspense>
      </div>
    </div>
  )
}

async function Chooser() {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  if (profile.roleChosen) redirect(homeFor(profile.role))
  return <RoleChooser firstName={user.name?.trim().split(/\s+/)[0] || null} initialRole={profile.role} />
}
