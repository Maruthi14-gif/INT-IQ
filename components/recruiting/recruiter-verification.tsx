"use client"

import { BadgeCheckIcon, ClockIcon, Loader2Icon, ShieldAlertIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { CompanyCheckList, VerdictBadge } from "@/components/recruiting/company-check-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from "@/lib/company-options"
import type { RecruiterStatus } from "@/lib/db/schema"
import type { Assessment } from "@/lib/recruiter-assessment"

export type CompanyDetails = {
  name: string | null
  website: string | null
  industry: string | null
  size: string | null
  headquarters: string | null
  linkedinUrl: string | null
  gstin: string | null
  about: string | null
}

export type RecruiterDetails = { jobTitle: string | null; linkedinUrl: string | null; note: string | null }

const SELECT =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"

/**
 * Shown on the recruiter dashboard until the account is approved: company details form,
 * then what INT-IQ checked about the company, or the reason a request was declined.
 */
export function RecruiterVerification({
  status,
  submitted,
  company,
  recruiter,
  reviewNote,
  assessment,
}: {
  status: Exclude<RecruiterStatus, "approved">
  submitted: boolean
  company: CompanyDetails
  recruiter: RecruiterDetails
  reviewNote: string | null
  assessment: Assessment | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!submitted || status === "rejected")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => {
      const v = form.get(name)
      return typeof v === "string" && v.trim() ? v.trim() : undefined
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/recruiter/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: {
            name: value("companyName"),
            website: value("companyWebsite"),
            industry: value("industry"),
            size: value("size"),
            headquarters: value("headquarters"),
            linkedinUrl: value("companyLinkedin"),
            gstin: value("gstin"),
            about: value("about"),
          },
          jobTitle: value("jobTitle"),
          linkedinUrl: value("linkedinUrl"),
          note: value("note"),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't send your details.")
      if (data.status === "approved") toast.success("Company verified. You can publish jobs and see candidates now.")
      else toast.success("Sent for review. An admin will check your company soon.")
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your details.")
    } finally {
      setBusy(false)
    }
  }

  const declined = status === "rejected"
  const waiting = submitted && !editing

  return (
    <section className="rounded-2xl border border-brand/40 bg-card p-6" aria-labelledby="verify-title" data-testid="recruiter-verification">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text">
          {declined ? <ShieldAlertIcon className="size-5" /> : waiting ? <ClockIcon className="size-5" /> : <BadgeCheckIcon className="size-5" />}
        </span>
        <div className="min-w-0 space-y-1">
          <h2 id="verify-title" className="text-lg font-medium">
            {declined ? "Your recruiter account wasn't approved" : waiting ? "Waiting for approval" : "Verify your company"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {declined
              ? "Update your details and send them again, or contact the INT-IQ team."
              : waiting
                ? "We checked your company. An INT-IQ admin makes the final call; you can keep drafting jobs meanwhile."
                : "Tell us who you hire for. INT-IQ checks that the company exists, so candidates know who's contacting them. Until you're approved you can draft jobs, but not publish them or see candidates."}
          </p>
          {declined && reviewNote && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Reason: </span>
              {reviewNote}
            </p>
          )}
        </div>
      </div>

      {waiting ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{company.name}</span>
            <span className="text-sm text-muted-foreground">{company.website?.replace(/^https?:\/\//, "")}</span>
            {assessment && <VerdictBadge verdict={assessment.verdict} />}
          </div>
          {assessment && <CompanyCheckList assessment={assessment} />}
          {assessment?.tip && <p className="text-sm text-brand-text">{assessment.tip}</p>}
          <Button variant="outline" className="h-9" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-medium">Your company</legend>
            <Field id="verify-company" label="Company name">
              <Input id="verify-company" name="companyName" required maxLength={120} defaultValue={company.name ?? ""} autoComplete="organization" />
            </Field>
            <Field id="verify-website" label="Company website">
              <Input id="verify-website" name="companyWebsite" required maxLength={200} placeholder="company.com" defaultValue={company.website ?? ""} autoComplete="url" />
            </Field>
            <Field id="verify-industry" label="Industry" optional>
              <select id="verify-industry" name="industry" defaultValue={company.industry ?? ""} className={SELECT}>
                <option value="">Choose…</option>
                {COMPANY_INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="verify-size" label="Company size" optional>
              <select id="verify-size" name="size" defaultValue={company.size ?? ""} className={SELECT}>
                <option value="">Choose…</option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} people
                  </option>
                ))}
              </select>
            </Field>
            <Field id="verify-hq" label="Headquarters" optional>
              <Input id="verify-hq" name="headquarters" maxLength={80} placeholder="Bengaluru" defaultValue={company.headquarters ?? ""} />
            </Field>
            <Field id="verify-company-linkedin" label="Company LinkedIn page" optional>
              <Input id="verify-company-linkedin" name="companyLinkedin" maxLength={200} placeholder="linkedin.com/company/…" defaultValue={company.linkedinUrl ?? ""} />
            </Field>
            <Field id="verify-gstin" label="GST number" optional hint="Indian companies: 15 characters. Checked against the GST rules.">
              <Input
                id="verify-gstin"
                name="gstin"
                maxLength={15}
                placeholder="27AAPFU0939F1ZV"
                className="font-mono uppercase"
                defaultValue={company.gstin ?? ""}
              />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="verify-about">
                About the company <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="verify-about" name="about" maxLength={600} rows={2} placeholder="What the company does, in a sentence or two." defaultValue={company.about ?? ""} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-medium">About you</legend>
            <Field id="verify-title-input" label="Your job title">
              <Input id="verify-title-input" name="jobTitle" required maxLength={100} placeholder="Talent acquisition lead" defaultValue={recruiter.jobTitle ?? ""} autoComplete="organization-title" />
            </Field>
            <Field id="verify-linkedin" label="Your LinkedIn profile" optional>
              <Input id="verify-linkedin" name="linkedinUrl" maxLength={200} placeholder="linkedin.com/in/your-name" defaultValue={recruiter.linkedinUrl ?? ""} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="verify-note">
                Anything the reviewer should know <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="verify-note" name="note" maxLength={1000} rows={2} defaultValue={recruiter.note ?? ""} />
            </div>
          </fieldset>

          <p className="text-sm text-muted-foreground">
            Signed in with your work email at the company&rsquo;s domain? Then a strong match is approved right away.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-10 px-4" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              {busy ? "Checking your company…" : declined ? "Send again" : "Verify my company"}
            </Button>
            {submitted && !declined && (
              <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

function Field({ id, label, optional, hint, children }: { id: string; label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
