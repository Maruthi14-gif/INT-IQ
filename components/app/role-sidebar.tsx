import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession } from "@/lib/session"

/**
 * Sidebar with the menu for the signed-in user's role. Reads the session, so it
 * renders inside <Suspense>; the fallback shows the student menu without a highlight.
 * Only the role string crosses to the client; the client picks the menu (icons are functions).
 */
export async function RoleSidebar({ user }: { user: ReactNode }) {
  const session = await getSession()
  const role = session ? (await getOrCreateProfile(session.user.id)).role : "student"
  return <AppSidebar user={user} role={role} />
}

export function RoleSidebarFallback({ user }: { user: ReactNode }) {
  return <AppSidebar user={user} />
}
