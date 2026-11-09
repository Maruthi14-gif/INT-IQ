import { auth } from "@/lib/auth/server"

/**
 * Neon Auth middleware:
 * - sends signed-out visitors to /sign-in (the login page and /api/auth are always public)
 * - finishes Google sign-in when Neon redirects back to the app
 * Add public marketing pages to `publicRoutes`. Pages and route handlers still
 * check the session themselves before reading user data.
 */
export default auth.middleware({
  loginUrl: "/sign-in",
  publicRoutes: ["/"],
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}
