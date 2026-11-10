import "server-only"
import { z } from "zod"
import type { CopilotPlan, LiveTranscriptTurn, Profile } from "@/lib/db/schema"
import { generateStructured } from "./model"
import { UNTRUSTED_RULE, untrusted } from "./untrusted"

const planSchema = z.object({
  focusAreas: z.array(z.string()).min(2).max(5).describe("The most relevant areas to explore in this interview."),
  verificationSkills: z.array(z.string()).min(1).max(6).describe("Resume or job claims that need concrete verification."),
  projectQuestions: z.array(z.string()).min(1).max(5).describe("Specific, open questions grounded in candidate projects or experience."),
  interviewPlan: z
    .array(z.object({ stage: z.string(), aim: z.string(), questions: z.array(z.string()).min(1).max(3) }))
    .min(3)
    .max(5),
})

const suggestionSchema = z.object({
  followUps: z.array(z.string()).min(1).max(4).describe("Short, neutral follow-up questions based on the transcript."),
  technicalChecks: z.array(z.string()).min(0).max(3).describe("Skills or claims worth testing next, with an exact question."),
  unexploredTopics: z.array(z.string()).min(0).max(4).describe("Important job-relevant areas the conversation has not covered."),
})

const evaluationDraftSchema = z.object({
  summary: z.string().min(1).max(900).describe("A concise evidence-based interview summary."),
  strengths: z.array(z.string()).max(5),
  weaknesses: z.array(z.string()).max(5),
  evidence: z.array(z.string()).min(1).max(6).describe("Specific claims grounded in transcript or recruiter notes, never invented."),
  recommendation: z.string().min(1).max(500).describe("A neutral draft for human review, not an automated hiring decision."),
})

type CopilotContext = {
  candidateName: string
  profile: Profile | null
  job: { title: string; company: string; description: string; skills: string[]; responsibilities: string | null }
}

function context(input: CopilotContext) {
  const job = [
    `Job: ${input.job.title} at ${input.job.company}`,
    `Required skills: ${input.job.skills.join(", ") || "not specified"}`,
    `Description: ${input.job.description.slice(0, 5000)}`,
  ]
  if (input.job.responsibilities) job.push(`Responsibilities: ${input.job.responsibilities.slice(0, 3000)}`)
  const lines = [untrusted("job_description", job.join("\n"))]
  if (input.profile?.resumeInsights) {
    const insights = input.profile.resumeInsights
    lines.push(`Candidate: ${input.candidateName}`)
    lines.push(
      untrusted(
        "resume",
        [
          `Summary: ${insights.summary}`,
          `Skills: ${insights.skills.join(", ") || "none extracted"}`,
          `Projects:\n${insights.projects.map((p) => `- ${p.name}: ${p.detail}`).join("\n") || "none extracted"}`,
        ].join("\n"),
      ),
    )
  } else if (input.profile?.resumeText) {
    lines.push(`Candidate: ${input.candidateName}`)
    lines.push(untrusted("resume", input.profile.resumeText.slice(0, 9000)))
  } else {
    lines.push(`Candidate: ${input.candidateName} (no resume supplied)`)
  }
  return lines.join("\n\n")
}

function transcript(turns: LiveTranscriptTurn[]) {
  const text = turns
    .slice(-40)
    .map((turn) => `${turn.speaker === "recruiter" ? "Recruiter" : "Candidate"}: ${turn.text}`)
    .join("\n")
    .slice(0, 14_000)
  return text ? untrusted("transcript", text) : ""
}

const SYSTEM =
  "You are an interview copilot assisting a recruiter. Be precise, fair, factual and job-related. " +
  "You may help the recruiter prepare questions and summarize evidence, but you must never make a hiring or rejection decision. " +
  "Never infer personality, honesty, emotion, protected characteristics or competence from appearance, voice, accent or demographics. " +
  "Do not invent resume experience, interview answers or evidence. " +
  UNTRUSTED_RULE

/** Pre-interview plan grounded in the candidate resume and the actual job. */
export async function buildCopilotPlan(input: CopilotContext): Promise<CopilotPlan> {
  return generateStructured({
    kind: "smart",
    schema: planSchema,
    temperature: 0.25,
    system: SYSTEM,
    prompt:
      `${context(input)}\n\n` +
      "Prepare a structured human interview plan. Include specific project questions, technical verification questions and a balanced sequence. " +
      "This is guidance only; the recruiter remains responsible for the interview and every decision.",
  })
}

/** Suggestions are generated only from a transcript that both participants agreed to save. */
export async function suggestCopilotFollowUps(input: CopilotContext & { turns: LiveTranscriptTurn[] }) {
  return generateStructured({
    kind: "fast",
    schema: suggestionSchema,
    temperature: 0.3,
    system: SYSTEM,
    prompt:
      `${context(input)}\n\nConsented transcript:\n${transcript(input.turns) || "No transcript has been saved yet."}\n\n` +
      "Suggest the next useful questions without repeating what has already been answered. Keep the questions concise and non-leading.",
  })
}

/** Draft only: the recruiter edits, approves and saves it themselves. */
export async function draftLiveEvaluation(input: CopilotContext & { turns: LiveTranscriptTurn[]; recruiterNotes: string | null }) {
  return generateStructured({
    kind: "smart",
    schema: evaluationDraftSchema,
    temperature: 0.2,
    system: SYSTEM,
    prompt:
      `${context(input)}\n\nConsented transcript:\n${transcript(input.turns) || "No transcript was captured."}\n\n` +
      `Recruiter notes:\n${input.recruiterNotes ? untrusted("notes", input.recruiterNotes.slice(0, 6000)) : "No notes."}\n\n` +
      "Create a balanced draft evaluation for the recruiter's private review. Clearly distinguish evidence from uncertainty. " +
      "The recommendation must explicitly leave the application status and hiring decision to the recruiter.",
  })
}
