import "server-only"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { cache } from "react"
import { isAdmin } from "@/lib/admin"
import { auth } from "@/lib/auth/server"
import type { UserRole } from "@/lib/db/schema"
import { getOrCreateProfile } from "@/lib/profiles"

/**
 * Data access layer for the signed-in user.
 * Reads request cookies, so callers must render inside a <Suspense> boundary
 * (Cache Components is enabled).
 */
export const getSession = cache(async () => {
  // Wait for the real request first. Any prerender pass (build or runtime prefetch)
  // stops here, so the Neon SDK only runs for real requests and doesn't log
  // "fetch/cookies rejected during prerendering" warnings.
  await connection()
  const { data } = await auth.getSession()
  return data?.user ? data : null
})

/** Returns the signed-in user or redirects to /sign-in. */
export async function requireUser() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  return session.user
}

/**
 * Signed-in user plus their profile. Users who haven't chosen a role yet are sent
 * to /welcome; a student on a recruiter page (or the reverse) is sent to their own home.
 */
export async function requireRole(role: UserRole) {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  if (!profile.roleChosen) redirect("/welcome")
  if (profile.role !== role) redirect(profile.role === "recruiter" ? "/recruiter" : "/dashboard")
  return { user, profile }
}

/** Admin pages: anyone else gets a 404, so the page's existence isn't revealed. */
export async function requireAdmin() {
  const user = await requireUser()
  if (!isAdmin(user)) notFound()
  return user
}

export const homeFor = (role: UserRole) => (role === "recruiter" ? "/recruiter" : "/dashboard")
