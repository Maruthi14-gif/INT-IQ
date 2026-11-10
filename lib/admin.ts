import "server-only"

/**
 * Admins are set with ADMIN_EMAILS (comma or space separated), never in the database,
 * so no request can promote itself. Only a verified email counts: a Google or
 * email-code sign-in proves the person owns the address.
 */
export function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdmin(user: { email?: string | null; emailVerified?: boolean | null } | null | undefined) {
  if (!user?.email || user.emailVerified !== true) return false
  return adminEmails().has(user.email.toLowerCase())
}
