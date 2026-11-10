import type { CompanyCheck, RecruiterEmailCheck } from "@/lib/db/schema"

/*
 * Turns the company check and the recruiter's email check into a verdict and plain-language
 * lines for the admin and the recruiter. Pure: no network, safe to use when rendering.
 *
 *   strong     the company exists (live website and an established domain, public record or
 *              active GST) AND the recruiter proved they work there (verified email on its domain)
 *   partial    the company exists, but nothing ties this recruiter to it yet
 *   weak       the domain exists, but the company looks new, unreachable or unclear
 *   not-found  no website exists at that address
 */

export type CheckVerdict = "strong" | "partial" | "weak" | "not-found"
export type CheckLine = { ok: boolean | null; text: string }
export type Assessment = { verdict: CheckVerdict; lines: CheckLine[]; tip: string | null }

const DAY_MS = 86_400_000
/** A domain younger than this is treated as new. */
const ESTABLISHED_DAYS = 180

export function domainAgeDays(check: CompanyCheck, now = Date.now()) {
  if (!check.domainRegisteredAt) return null
  const registered = Date.parse(check.domainRegisteredAt)
  return Number.isNaN(registered) ? null : Math.max(0, Math.floor((now - registered) / DAY_MS))
}

function ageText(days: number) {
  if (days >= 730) return `${Math.floor(days / 365)} years`
  if (days >= 60) return `${Math.floor(days / 30)} months`
  return days === 1 ? "1 day" : `${days} days`
}

export function assessRecruiter(company: CompanyCheck | null, email: RecruiterEmailCheck | null): Assessment {
  if (!company) return { verdict: "weak", lines: [], tip: null }
  const { domain } = company

  if (!company.domainExists) {
    return {
      verdict: "not-found",
      lines: [{ ok: false, text: `No website or registered domain exists at ${domain}` }],
      tip: "Check the website address.",
    }
  }

  const lines: CheckLine[] = []
  const age = domainAgeDays(company)
  const gst = company.gst
  const gstActive = Boolean(gst?.registry && /active/i.test(gst.registry.status) && gst.registry.nameMatches)
  const established = (age !== null && age >= ESTABLISHED_DAYS) || Boolean(company.publicRecord) || gstActive
  const reachable = company.website.reachable
  const emailOnDomain = email?.matchesWebsite === true && email.verified === true

  lines.push(
    reachable
      ? { ok: true, text: company.website.title ? `Website is live: “${company.website.title.slice(0, 80)}”` : "Website is live" }
      : { ok: false, text: "The website didn't respond" },
  )
  lines.push(
    age === null
      ? { ok: null, text: "Domain age unknown" }
      : { ok: age >= ESTABLISHED_DAYS, text: `Domain registered ${ageText(age)} ago` },
  )
  if (company.nameOnWebsite !== null) {
    lines.push(
      company.nameOnWebsite
        ? { ok: true, text: "The website matches the company name" }
        : { ok: false, text: "The website doesn't mention this company name" },
    )
  }
  if (company.mailServer !== null) {
    lines.push(company.mailServer ? { ok: true, text: "The domain receives email" } : { ok: false, text: "The domain has no mail server" })
  }
  lines.push(
    company.publicRecord
      ? { ok: true, text: `Listed in public records as ${company.publicRecord.label} (Wikidata ${company.publicRecord.id})` }
      : { ok: null, text: "Not in public records (common for smaller companies)" },
  )
  if (gst) {
    if (!gst.formatValid) lines.push({ ok: false, text: "The GST number isn't valid" })
    else if (gst.registry)
      lines.push({
        ok: gstActive,
        text: `GST ${gst.registry.status.toLowerCase()}: ${gst.registry.legalName}${gst.registry.nameMatches ? "" : " (name differs)"}`,
      })
    else lines.push({ ok: null, text: "GST number is well formed (registry not checked)" })
  }
  if (email) {
    if (email.disposable === true) lines.push({ ok: false, text: "Signed up with a throwaway email address" })
    else if (emailOnDomain) lines.push({ ok: true, text: `Signed in with a verified email at ${domain}` })
    else if (email.matchesWebsite) lines.push({ ok: null, text: `Email is at ${domain}, but it isn't verified` })
    else if (email.freeMail) lines.push({ ok: false, text: `Signed in with a personal email (${email.domain})` })
    else lines.push({ ok: false, text: `Email domain ${email.domain} isn't the company's` })
  }

  let verdict: CheckVerdict = "weak"
  if (email?.disposable !== true && reachable && established) verdict = emailOnDomain ? "strong" : "partial"

  const tip =
    verdict === "strong"
      ? null
      : !emailOnDomain && email?.disposable !== true
        ? `Sign in with your work email at ${domain} to be approved right away. Otherwise an admin reviews your request.`
        : "An admin will review your request."

  return { verdict, lines, tip }
}

export const VERDICT_LABEL: Record<CheckVerdict, string> = {
  strong: "Strong match",
  partial: "Company found",
  weak: "Needs a closer look",
  "not-found": "Company not found",
}
