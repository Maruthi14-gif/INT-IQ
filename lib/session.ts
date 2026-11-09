import "server-only"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { cache } from "react"
import { auth } from "@/lib/auth/server"

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
