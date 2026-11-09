import "server-only"
import { z } from "zod"
import type { InterviewReport, InterviewTurn, InterviewType, Profile, ResumeInsights } from "@/lib/db/schema"
import { generateStructured, streamSpoken } from "./model"

/* ── Resume analysis ────────────────────────────────────────── */

const resumeSchema = z.object({
  summary: z.string().describe("Two sentences describing the candidate, factual, second person is not allowed."),
  skills: z.array(z.string()).max(16).describe("Concrete technical and soft skills found in the resume."),
  projects: z
    .array(z.object({ name: z.string(), detail: z.string().describe("One sentence: what they built and with what.") }))
    .max(4),
  strengths: z.array(z.string()).max(3).describe("Strengths relevant to the target role."),
  gaps: z.array(z.string()).max(3).describe("Skills or evidence missing for the target role, phrased as things to work on."),
})

export async function analyzeResume(input: { resumeText: string; targetRole: string; jobDescription?: string | null }) {
  return generateStructured({
    kind: "smart",
    schema: resumeSchema,
    temperature: 0.2,
    system:
      "You are a career coach and technical recruiter for university students. Extract concise, factual insights from a resume. " +
      "Never invent experience, employers, numbers or skills that are not in the resume.",
    prompt:
      `Target role: ${input.targetRole}\n` +
      (input.jobDescription ? `Job description:\n${input.jobDescription.slice(0, 3000)}\n\n` : "") +
      `Resume:\n${input.resumeText.slice(0, 12000)}`,
  }) satisfies Promise<ResumeInsights>
}

/* ── Interviewer ────────────────────────────────────────────── */

const ROUND_GUIDE: Record<InterviewType, string> = {
  technical:
    "Technical round: test fundamentals for the role, dig into the candidate's own projects and technical decisions, " +
    "and include at least one small problem-solving or design question. Follow up when an answer is vague.",
  behavioral:
    "Behavioral round: ask about real situations (teamwork, conflict, failure, ownership, deadlines, learning something fast). " +
    "Push for specifics using the STAR shape (situation, task, action, result) without naming it.",
  hr:
    "HR round: motivation, why this role and company type, strengths and weaknesses, career goals, handling pressure, " +
    "and a fresher-friendly expectations question. Keep it warm and conversational.",
}

const LEVEL_GUIDE: Record<string, string> = {
  fresher: "The candidate is a student or fresher: pitch difficulty at campus-placement level.",
  junior: "The candidate has about 0-2 years of experience: pitch difficulty at junior level.",
  mid: "The candidate has 2-5 years of experience: expect depth and trade-offs.",
}

function candidateContext(profile: Profile | null, targetRole: string) {
  const insights = profile?.resumeInsights
  const lines = [`Target role: ${targetRole}`, LEVEL_GUIDE[profile?.experienceLevel ?? "fresher"]]
  if (insights) {
    lines.push(`Candidate summary: ${insights.summary}`)
    if (insights.skills.length) lines.push(`Skills: ${insights.skills.join(", ")}`)
    if (insights.projects.length)
      lines.push(`Projects:\n${insights.projects.map((p) => `- ${p.name}: ${p.detail}`).join("\n")}`)
  } else if (profile?.resumeText) {
    lines.push(`Resume:\n${profile.resumeText.slice(0, 4000)}`)
  } else {
    lines.push("No resume provided: ask general questions for the role.")
  }
  if (profile?.jobDescription) lines.push(`Job description:\n${profile.jobDescription.slice(0, 2000)}`)
  return lines.join("\n")
}

function transcript(turns: InterviewTurn[]) {
  return turns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer?.trim() ? t.answer.trim() : "(no answer)"}`)
    .join("\n\n")
}

const INTERVIEWER_SYSTEM =
  "You are a friendly, sharp interviewer at a good tech company, interviewing a student by voice. " +
  "Your words are read aloud, so write the way people speak: short sentences, no lists, no markdown, no emojis, " +
  "never number questions. Ask exactly one question at a time. When there is a previous answer, react to one specific " +
  "detail in a short clause first (never generic praise like 'great answer'), then ask the next question. " +
  "Keep each turn under 60 words."

type QuestionInput = {
  type: InterviewType
  targetRole: string
  profile: Profile | null
  firstName: string
  turns: InterviewTurn[]
  totalQuestions: number
}

function questionPrompt(input: QuestionInput) {
  const number = input.turns.length + 1
  const isFirst = number === 1
  const isLast = number === input.totalQuestions
  return {
    system: `${INTERVIEWER_SYSTEM}\n\n${ROUND_GUIDE[input.type]}`,
    prompt:
      `${candidateContext(input.profile, input.targetRole)}\n\n` +
      (isFirst
        ? `Start the interview. Greet ${input.firstName} by first name in one short sentence, mention the ${input.type} round for the ${input.targetRole} role, then ask the first question.`
        : `Conversation so far:\n${transcript(input.turns)}\n\nAsk question ${number} of ${input.totalQuestions}.` +
          (isLast ? " This is the final question." : "") +
          " Build on what they said when it helps; otherwise move to a new area. Don't repeat earlier questions."),
  }
}

export async function nextQuestion(input: QuestionInput) {
  const { question } = await generateStructured({
    kind: "fast",
    schema: z.object({ question: z.string().describe("What the interviewer says next, spoken style.") }),
    temperature: 0.8,
    ...questionPrompt(input),
  })
  return question.trim()
}

/** Same as nextQuestion, streamed as plain text for the voice call (the voice starts on the first words). */
export async function* streamNextQuestion(input: QuestionInput) {
  const { system, prompt } = questionPrompt(input)
  for await (const text of streamSpoken({ system: `${system}\nReply with only the words to say.`, prompt, temperature: 0.8 })) {
    // Read aloud, so drop markdown symbols the model sometimes adds.
    yield text.replace(/[*#_`]/g, "")
  }
}

/* ── Report ─────────────────────────────────────────────────── */

const score10 = z.number().min(0).max(10)

const reportSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("Overall interview performance, 0-100. 70+ means ready for a real interview."),
  verdict: z.string().describe("A 3-6 word verdict, e.g. 'Almost interview-ready' or 'Needs more practice'."),
  summary: z.string().describe("2-3 sentences of honest, specific overall feedback addressed to the candidate as 'you'."),
  scores: z.object({
    clarity: score10,
    structure: score10,
    depth: score10,
    relevance: score10,
    confidence: score10,
  }),
  strengths: z.array(z.string()).min(1).max(3),
  improvements: z.array(z.string()).min(1).max(3).describe("Concrete, actionable fixes."),
  answers: z
    .array(
      z.object({
        score: score10,
        feedback: z.string().describe("1-2 sentences: what worked and what was missing in this answer."),
        betterAnswer: z
          .string()
          .describe("A strong example answer in first person, 3-5 sentences, using the candidate's real background where possible."),
      }),
    )
    .describe("One entry per question, in the same order."),
  nextSteps: z.array(z.string()).min(1).max(3).describe("What to practice next."),
})

export async function buildReport(input: {
  type: InterviewType
  targetRole: string
  profile: Profile | null
  turns: InterviewTurn[]
}): Promise<InterviewReport> {
  const report = await generateStructured({
    kind: "smart",
    schema: reportSchema,
    temperature: 0.3,
    system:
      "You are an experienced interview coach. Grade a mock interview honestly and kindly. " +
      "Score each answer on substance: missing, one-line or off-topic answers score 0-3; solid answers 6-8; excellent 9-10. " +
      "Feedback must reference what the candidate actually said. Never invent things they said.",
    prompt:
      `Round: ${input.type}\n${candidateContext(input.profile, input.targetRole)}\n\n` +
      `Interview transcript (${input.turns.length} questions):\n${transcript(input.turns)}`,
  })
  // Keep exactly one review per question.
  const answers = input.turns.map(
    (_, i) => report.answers[i] ?? { score: 0, feedback: "No feedback for this answer.", betterAnswer: "" },
  )
  return { ...report, overallScore: Math.round(report.overallScore), answers }
}
