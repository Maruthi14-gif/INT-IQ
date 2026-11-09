import "server-only"
import { createNeonAuth } from "@neon/auth/next/server"

/**
 * Neon Auth (managed Better Auth). Users and sessions live in the `neon_auth`
 * schema of the Neon branch; this instance proxies auth calls to Neon and
 * reads the session in Server Components, Route Handlers and proxy.ts.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
})
