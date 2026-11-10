import { extractText, getDocumentProxy } from "unpdf"
import { analyzeResume } from "@/lib/ai/interviewer"
import { isAiConfigured } from "@/lib/ai/model"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { EXPERIENCE_LEVELS, type ExperienceLevel, type ResumeInsights } from "@/lib/db/schema"
import { getOrCreateProfile, saveResume } from "@/lib/profiles"
import { rateLimited } from "@/lib/rate-limit"

export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024
/** A resume is a page or two; a huge PDF is a mistake or an attack on the parser. */
const MAX_PAGES = 15
const PARSE_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PDF parsing timed out")), ms)),
  ])
}

/** Save target role + resume (PDF/TXT upload or pasted text) and analyze it with AI. */
export async function POST(request: Request) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error
  const limited = await rateLimited("resume", user.id)
  if (limited) return limited

  const form = await request.formData()
  const targetRole = String(form.get("targetRole") ?? "").trim().slice(0, 80)
  const level = String(form.get("experienceLevel") ?? "fresher") as ExperienceLevel
  const jobDescription = String(form.get("jobDescription") ?? "").trim().slice(0, 6000) || null
  const pasted = String(form.get("resumeText") ?? "").trim()
  const file = form.get("file")

  if (!targetRole) return jsonError(400, "Add the role you're preparing for.")
  if (!EXPERIENCE_LEVELS.includes(level)) return jsonError(400, "Pick your experience level.")

  const existing = await getOrCreateProfile(user.id)
  let resumeText = existing.resumeText
  let resumeFileName = existing.resumeFileName

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return jsonError(400, "That file is over 4 MB. Try a smaller PDF.")
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith(".pdf") || file.type === "application/pdf") {
        const pdf = await withTimeout(getDocumentProxy(new Uint8Array(await file.arrayBuffer())), PARSE_TIMEOUT_MS)
        if (pdf.numPages > MAX_PAGES) {
          return jsonError(400, `That PDF has ${pdf.numPages} pages. Upload a resume of ${MAX_PAGES} pages or fewer.`)
        }
        const { text } = await withTimeout(extractText(pdf, { mergePages: true }), PARSE_TIMEOUT_MS)
        resumeText = text
      } else if (name.endsWith(".txt") || file.type.startsWith("text/")) {
        resumeText = await file.text()
      } else {
        return jsonError(400, "Upload a PDF (or paste your resume as text).")
      }
    } catch (error) {
      console.error("[resume] could not read file", error)
      return jsonError(400, "We couldn't read that PDF. Try exporting it again, or paste the text instead.")
    }
    resumeFileName = file.name.slice(0, 120)
  } else if (pasted) {
    resumeText = pasted
    resumeFileName = null
  }

  resumeText = resumeText?.replace(/\s+\n/g, "\n").trim().slice(0, 20000) || null
  if (resumeText && resumeText.length < 80) {
    return jsonError(400, "We could only find a few words in that resume. If it's a scanned image, paste the text instead.")
  }

  let resumeInsights: ResumeInsights | null = existing.resumeInsights
  let warning: string | null = null
  const resumeChanged = resumeText !== existing.resumeText
  const roleChanged = targetRole !== existing.targetRole || jobDescription !== existing.jobDescription
  if (resumeText && (resumeChanged || roleChanged || !resumeInsights)) {
    if (!isAiConfigured()) {
      warning = "Saved. AI analysis is off until GEMINI_API_KEY is set."
    } else {
      try {
        resumeInsights = await analyzeResume({ resumeText, targetRole, jobDescription })
      } catch (error) {
        console.error("[resume] analysis failed", error)
        warning = "Saved, but the AI analysis didn't finish. Save again to retry."
      }
    }
  }

  const profile = await saveResume(user.id, {
    targetRole,
    experienceLevel: level,
    jobDescription,
    resumeFileName,
    resumeText,
    resumeInsights: resumeText ? resumeInsights : null,
  })

  return Response.json({
    warning,
    profile: {
      targetRole: profile.targetRole,
      experienceLevel: profile.experienceLevel,
      jobDescription: profile.jobDescription,
      resumeFileName: profile.resumeFileName,
      hasResume: Boolean(profile.resumeText),
      resumeInsights: profile.resumeInsights,
    },
  })
}
