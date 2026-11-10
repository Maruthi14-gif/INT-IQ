import "server-only"
import type { RecruiterEmailCheck } from "@/lib/db/schema"

/** Personal mail providers: fine for candidates, a yellow flag for a recruiter. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "yahoo.in",
  "ymail.com",
  "rediffmail.com",
  "outlook.com",
  "outlook.in",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "zohomail.in",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "tutanota.com",
])

function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/** Kickbox Open (free, no key). Returns null when it can't be reached, so a failed check never blocks anyone. */
async function isDisposable(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://open.kickbox.com/v1/disposable/${encodeURIComponent(domain)}`, {
      headers: { "user-agent": "INT-IQ recruiter check" },
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const disposable = (data as { disposable?: unknown } | null)?.disposable
    return typeof disposable === "boolean" ? disposable : null
  } catch {
    return null
  }
}

/**
 * Signals about the recruiter's own sign-in email. `verified` (a Google or email-code sign-in)
 * plus an address on the company's domain is what proves the recruiter works there.
 */
export async function checkRecruiterEmail(email: string, companyWebsite: string | null, verified = false): Promise<RecruiterEmailCheck> {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? ""
  const site = companyWebsite ? hostOf(companyWebsite) : null
  return {
    domain,
    freeMail: FREE_MAIL.has(domain),
    disposable: domain ? await isDisposable(domain) : null,
    matchesWebsite: site && domain ? domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`) : null,
    verified,
    checkedAt: new Date().toISOString(),
  }
}
