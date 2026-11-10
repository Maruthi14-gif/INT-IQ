import "server-only"
import { and, count, desc, eq, sql } from "drizzle-orm"
import { checkCompany, normalizeWebsite } from "@/lib/company-check"
import { db } from "@/lib/db"
import { authUsers } from "@/lib/db/neon-auth"
import { withRetry } from "@/lib/db/retry"
import {
  companies,
  jobs,
  profiles,
  recruiterProfiles,
  type CompanyIndustry,
  type CompanySize,
  type RecruiterProfile,
  type RecruiterStatus,
} from "@/lib/db/schema"
import { checkRecruiterEmail } from "@/lib/email-check"
import { assessRecruiter, type Assessment } from "@/lib/recruiter-assessment"

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

/** The recruiter's verification row, created as "pending" on first use. */
export async function getRecruiterProfile(userId: string): Promise<RecruiterProfile> {
  return withRetry(async () => {
    const [created] = await db.insert(recruiterProfiles).values({ userId }).onConflictDoNothing().returning()
    if (created) return created
    const [existing] = await db.select().from(recruiterProfiles).where(eq(recruiterProfiles.userId, userId)).limit(1)
    return existing
  })
}

/** The recruiter's verification row plus the company they hire for (if they've sent it). */
export async function getRecruiterWithCompany(userId: string) {
  const recruiter = await getRecruiterProfile(userId)
  if (!recruiter.companyId) return { recruiter, company: null }
  const [company] = await withRetry(() => db.select().from(companies).where(eq(companies.id, recruiter.companyId!)).limit(1))
  return { recruiter, company: company ?? null }
}

export const isApprovedRecruiter = (profile: { status: RecruiterStatus }) => profile.status === "approved"

export type VerificationInput = {
  company: {
    name: string
    website: string
    industry: CompanyIndustry | null
    size: CompanySize | null
    headquarters: string | null
    linkedinUrl: string | null
    gstin: string | null
    about: string | null
  }
  jobTitle: string
  linkedinUrl: string | null
  note: string | null
}

export type VerificationResult =
  | { outcome: "invalid-website" }
  | { outcome: "not-found"; domain: string }
  | { outcome: "approved" | "pending"; profile: RecruiterProfile; assessment: Assessment }

/**
 * A recruiter sends their company's details. INT-IQ checks that the company exists, saves it
 * (one shared row per company domain) and approves a not-yet-reviewed recruiter right away when
 * the match is strong: an established company plus a verified sign-in email on its own domain.
 * Otherwise the request waits for an admin. An approved recruiter stays approved.
 */
export async function submitRecruiterVerification(
  user: { id: string; email: string; emailVerified: boolean },
  input: VerificationInput,
): Promise<VerificationResult> {
  const website = normalizeWebsite(input.company.website)
  if (!website) return { outcome: "invalid-website" }

  const current = await getRecruiterProfile(user.id)
  const [companyCheck, emailCheck] = await Promise.all([
    checkCompany({ name: input.company.name, website, gstin: input.company.gstin }),
    checkRecruiterEmail(user.email, website.url, user.emailVerified),
  ])
  if (!companyCheck.domainExists) return { outcome: "not-found", domain: website.domain }

  const assessment = assessRecruiter(companyCheck, emailCheck)
  // Never automatic after an admin declined: a declined recruiter's new details go back to the admin.
  const automatic = current.status === "pending" && assessment.verdict === "strong"
  const approve = current.status === "approved" || automatic
  const now = new Date()

  return db.transaction(async (tx) => {
    // One company per domain: the first details sent stay, empty fields get filled in, checks refresh.
    const [company] = await tx
      .insert(companies)
      .values({
        name: input.company.name,
        domain: website.domain,
        website: website.url,
        industry: input.company.industry,
        size: input.company.size,
        headquarters: input.company.headquarters,
        linkedinUrl: input.company.linkedinUrl,
        gstin: input.company.gstin,
        about: input.company.about,
        check: companyCheck,
        checkedAt: now,
        createdBy: user.id,
      })
      .onConflictDoUpdate({
        target: companies.domain,
        set: {
          check: companyCheck,
          checkedAt: now,
          industry: sql`coalesce(${companies.industry}, excluded.industry)`,
          size: sql`coalesce(${companies.size}, excluded.size)`,
          headquarters: sql`coalesce(${companies.headquarters}, excluded.headquarters)`,
          linkedinUrl: sql`coalesce(${companies.linkedinUrl}, excluded.linkedin_url)`,
          gstin: sql`coalesce(${companies.gstin}, excluded.gstin)`,
          about: sql`coalesce(${companies.about}, excluded.about)`,
        },
      })
      .returning()

    const [profile] = await tx
      .update(recruiterProfiles)
      .set({
        companyId: company.id,
        companyName: input.company.name,
        companyWebsite: website.url,
        jobTitle: input.jobTitle,
        linkedinUrl: input.linkedinUrl,
        note: input.note,
        emailCheck,
        submittedAt: now,
        status: approve ? "approved" : "pending",
        ...(current.status === "approved"
          ? {}
          : {
              reviewedAt: automatic ? now : null,
              reviewedBy: null,
              reviewNote: automatic ? `Approved automatically: verified work email at ${website.domain} and an established company.` : null,
            }),
      })
      .where(eq(recruiterProfiles.userId, user.id))
      .returning()
    return { outcome: approve ? ("approved" as const) : ("pending" as const), profile, assessment }
  })
}

/** Every recruiter for the admin page, with their company: waiting requests first. */
export async function listRecruiterRequests() {
  return withRetry(() =>
    db
      .select({ request: recruiterProfiles, name: authUsers.name, email: authUsers.email, company: companies })
      .from(recruiterProfiles)
      .innerJoin(authUsers, eq(authUsers.id, recruiterProfiles.userId))
      .innerJoin(profiles, and(eq(profiles.userId, recruiterProfiles.userId), eq(profiles.role, "recruiter")))
      .leftJoin(companies, eq(companies.id, recruiterProfiles.companyId))
      .orderBy(
        sql`case ${recruiterProfiles.status} when 'pending' then 0 when 'rejected' then 1 else 2 end`,
        desc(recruiterProfiles.submittedAt),
        desc(recruiterProfiles.createdAt),
      )
      .limit(200),
  )
}

export type RecruiterRequest = Awaited<ReturnType<typeof listRecruiterRequests>>[number]

export async function pendingRecruiterCount() {
  const [row] = await withRetry(() =>
    db
      .select({ n: count() })
      .from(recruiterProfiles)
      .innerJoin(profiles, and(eq(profiles.userId, recruiterProfiles.userId), eq(profiles.role, "recruiter")))
      .where(eq(recruiterProfiles.status, "pending")),
  )
  return row?.n ?? 0
}

/**
 * An admin approves or declines a recruiter. Declining also closes the recruiter's open
 * jobs, in the same transaction, so candidates stop applying to them.
 */
export async function reviewRecruiter(adminId: string, userId: string, decision: "approved" | "rejected", note: string | null) {
  if (!isUuid(userId)) return null
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(recruiterProfiles)
      .set({ status: decision, reviewedAt: new Date(), reviewedBy: adminId, reviewNote: note })
      .where(eq(recruiterProfiles.userId, userId))
      .returning()
    if (!row) return null
    if (decision === "rejected") {
      await tx.update(jobs).set({ status: "closed" }).where(and(eq(jobs.recruiterId, userId), eq(jobs.status, "open")))
    }
    return row
  })
}
