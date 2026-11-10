import { NavUser } from "@/components/app/nav-user"
import { getOrCreateProfile } from "@/lib/profiles"
import { getSession } from "@/lib/session"

/** Reads the session, so render it inside <Suspense>. */
export async function SidebarUser() {
  const session = await getSession()
  if (!session) return null
  const { name, email, image } = session.user
  const profile = await getOrCreateProfile(session.user.id)
  return <NavUser user={{ name, email, image }} role={profile.role} />
}
