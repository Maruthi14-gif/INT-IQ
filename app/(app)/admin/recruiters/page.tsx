import { ExternalLinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { RecruiterReview } from "@/components/admin/recruiter-review"
import { CompanyCheckList, VerdictBadge } from "@/components/recruiting/company-check-list"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { RecruiterStatus } from "@/lib/db/schema"
import { assessRecruiter } from "@/lib/recruiter-assessment"
import { listRecruiterRequests, type RecruiterRequest } from "@/lib/recruiters"
import { requireAdmin } from "@/lib/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Recruiter approvals" }

export default function RecruiterApprovalsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        }
      >
        <Requests />
      </Suspense>
    </div>
  )
}

async function Requests() {
  // Checked before anything renders: non-admins get a 404 and never see this page.
  await requireAdmin()
  const all = await listRecruiterRequests()
  const groups: { title: string; hint: string; items: RecruiterRequest[] }[] = [
    { title: "Waiting for review", hint: "Sent their company details", items: all.filter((r) => r.request.status === "pending" && r.request.submittedAt) },
    { title: "Not sent yet", hint: "Chose recruiter but haven't sent company details", items: all.filter((r) => r.request.status === "pending" && !r.request.submittedAt) },
    { title: "Declined", hint: "Can update their details and ask again", items: all.filter((r) => r.request.status === "rejected") },
    { title: "Approved", hint: "Full recruiter access", items: all.filter((r) => r.request.status === "approved") },
  ]

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-medium">Recruiter approvals</h1>
        <p className="max-w-2xl text-muted-foreground">
          INT-IQ checks each recruiter&rsquo;s company on the open internet. A strong match (an established company and a verified work email on its
          domain) is approved automatically; everyone else waits here for you.
        </p>
      </header>
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.title} className="space-y-3" aria-label={group.title}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-medium">{group.title}</h2>
              <span className="font-mono text-sm text-muted-foreground tabular-nums">{group.items.length}</span>
              <span className="text-sm text-muted-foreground">{group.hint}</span>
            </div>
            <ul className="space-y-3">
              {group.items.map((item) => (
                <RequestCard key={item.request.userId} item={item} />
              ))}
            </ul>
          </section>
        ),
      )}
      {all.length === 0 && <p className="rounded-2xl border bg-card px-6 py-10 text-center text-muted-foreground">No recruiters yet.</p>}
    </div>
  )
}

const STATUS_LABEL: Record<RecruiterStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Declined" }

function RequestCard({ item }: { item: RecruiterRequest }) {
  const { request, company } = item
  const name = item.name?.trim() || item.email
  const assessment = company?.check ? assessRecruiter(company.check, request.emailCheck) : null
  const automatic = request.status === "approved" && request.reviewedAt && !request.reviewedBy && request.submittedAt

  return (
    <li className="space-y-4 rounded-2xl border bg-card p-5" data-testid="recruiter-request" data-email={item.email}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {item.email}
            {request.jobTitle && ` · ${request.jobTitle}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {request.submittedAt && (
            <span className="text-xs text-muted-foreground">
              Sent {request.submittedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
          {assessment && <VerdictBadge verdict={assessment.verdict} />}
          <Badge
            variant="outline"
            className={cn(
              request.status === "approved" && "border-success/30 bg-success/10 text-success",
              request.status === "pending" && "border-brand/40 text-brand-text",
              request.status === "rejected" && "border-destructive/30 text-destructive",
            )}
          >
            {automatic ? "Approved automatically" : STATUS_LABEL[request.status]}
          </Badge>
        </div>
      </div>

      {company ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <div className="min-w-0 space-y-3">
            <div>
              <p className="font-medium">{company.name}</p>
              <SafeLink href={company.website} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Industry">{company.industry ?? "Not given"}</Field>
              <Field label="Size">{company.size ? `${company.size} people` : "Not given"}</Field>
              <Field label="Headquarters">{company.headquarters ?? "Not given"}</Field>
              <Field label="GST number">{company.gstin ? <span className="font-mono">{company.gstin}</span> : "Not given"}</Field>
              <Field label="Company LinkedIn">{company.linkedinUrl ? <SafeLink href={company.linkedinUrl} /> : "Not given"}</Field>
              <Field label="Recruiter LinkedIn">{request.linkedinUrl ? <SafeLink href={request.linkedinUrl} /> : "Not given"}</Field>
            </dl>
            {company.about && <p className="text-sm text-muted-foreground">{company.about}</p>}
            {request.note && (
              <p className="text-sm">
                <span className="text-muted-foreground">Note: </span>
                <span className="whitespace-pre-wrap">{request.note}</span>
              </p>
            )}
          </div>
          {assessment && (
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="mb-2 text-sm font-medium">What INT-IQ checked</p>
              <CompanyCheckList assessment={assessment} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Hasn&rsquo;t sent company details yet.</p>
      )}

      {request.reviewNote && request.status !== "pending" && (
        <p className="text-sm">
          <span className="text-muted-foreground">{request.status === "rejected" ? "Reason given: " : "Note: "}</span>
          {request.reviewNote}
        </p>
      )}

      <RecruiterReview userId={request.userId} name={name} status={request.status} />
    </li>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  )
}

/** Recruiter-supplied links: only http(s), opened without sharing the admin's page. */
function SafeLink({ href }: { href: string | null }) {
  if (!href) return <>Not given</>
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`
  let safe: URL
  try {
    safe = new URL(url)
    if (safe.protocol !== "https:" && safe.protocol !== "http:") throw new Error("bad protocol")
  } catch {
    return <>{href}</>
  }
  return (
    <a href={safe.toString()} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-sm text-brand-text hover:underline">
      <span className="truncate">{safe.host + (safe.pathname === "/" ? "" : safe.pathname)}</span>
      <ExternalLinkIcon className="size-3.5 shrink-0" />
    </a>
  )
}
