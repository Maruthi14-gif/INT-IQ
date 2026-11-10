import { z } from "zod"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { gstinFormatValid } from "@/lib/company-check"
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from "@/lib/db/schema"
import { rateLimited } from "@/lib/rate-limit"
import { submitRecruiterVerification } from "@/lib/recruiters"

// The company checks call several free services, each capped at 5 seconds.
export const maxDuration = 30

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null)

const linkedin = (kind: "company" | "person") =>
  optionalText(200).refine(
    (value) => value === null || /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\//i.test(value),
    kind === "company" ? "That doesn't look like a LinkedIn company page." : "That doesn't look like a LinkedIn link.",
  )

const body = z.object({
  company: z.object({
    name: z.string().trim().min(2, "Add your company's name.").max(120),
    website: z.string().trim().min(3, "Add your company's website.").max(200),
    industry: z.enum(COMPANY_INDUSTRIES).optional().nullable().catch(null).transform((value) => value ?? null),
    size: z.enum(COMPANY_SIZES).optional().nullable().catch(null).transform((value) => value ?? null),
    headquarters: optionalText(80),
    linkedinUrl: linkedin("company"),
    gstin: optionalText(15)
      .transform((value) => (value ? value.toUpperCase().replace(/\s+/g, "") : null))
      .refine((value) => value === null || gstinFormatValid(value), "That GST number isn't valid. Check the 15 characters, or leave it empty."),
    about: optionalText(600),
  }),
  jobTitle: z.string().trim().min(2, "Add your job title.").max(100),
  linkedinUrl: linkedin("person"),
  note: optionalText(1000),
})

/**
 * A recruiter sends their company's details. INT-IQ checks the company exists and either
 * approves the recruiter right away (strong match) or queues them for an admin.
 */
export async function POST(request: Request) {
  const { user, error } = await apiUserWithRole("recruiter")
  if (!user) return error
  const limited = await rateLimited("recruiter-verification", user.id)
  if (limited) return limited

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Check your details.")

  const result = await submitRecruiterVerification(
    { id: user.id, email: user.email, emailVerified: user.emailVerified === true },
    parsed.data,
  )
  if (result.outcome === "invalid-website") return jsonError(400, "Enter your company's website, like company.com.")
  if (result.outcome === "not-found") {
    return jsonError(400, `We couldn't find a company website at ${result.domain}. Check the address.`)
  }
  return Response.json({ status: result.profile.status, verdict: result.assessment.verdict })
}
