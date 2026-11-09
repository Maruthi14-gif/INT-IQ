import { integer, jsonb, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core"
import { authUsers } from "./neon-auth"

/* ─────────────────────────────────────────────────────────────
 * App tables (public schema, managed with drizzle-kit).
 * Users and sessions live in Neon Auth (`neon_auth` schema).
 * ───────────────────────────────────────────────────────────── */

export const USER_ROLES = ["student", "recruiter"] as const
export type UserRole = (typeof USER_ROLES)[number]

export const EXPERIENCE_LEVELS = ["fresher", "junior", "mid"] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

/** What the AI pulled out of the resume. */
export type ResumeInsights = {
  summary: string
  skills: string[]
  projects: { name: string; detail: string }[]
  strengths: string[]
  gaps: string[]
}

/** One row per user: app-specific data that doesn't belong in auth. */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  role: text("role", { enum: USER_ROLES }).default("student").notNull(),
  targetRole: text("target_role"),
  experienceLevel: text("experience_level", { enum: EXPERIENCE_LEVELS }),
  jobDescription: text("job_description"),
  resumeFileName: text("resume_file_name"),
  resumeText: text("resume_text"),
  resumeInsights: jsonb("resume_insights").$type<ResumeInsights>(),
  resumeUpdatedAt: timestamp("resume_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export type Profile = typeof profiles.$inferSelect

/* ── Interviews ─────────────────────────────────────────────── */

export const INTERVIEW_TYPES = ["technical", "behavioral", "hr"] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]

/** text: browser voice + typing (built in). voice: real-time voice call through Vapi. */
export const INTERVIEW_MODES = ["text", "voice"] as const
export type InterviewMode = (typeof INTERVIEW_MODES)[number]

export type InterviewTurn = {
  question: string
  answer?: string
  answeredAt?: string
}

export type AnswerReview = {
  score: number // 0-10
  feedback: string
  betterAnswer: string
}

export type InterviewReport = {
  overallScore: number // 0-100
  verdict: string
  summary: string
  scores: { clarity: number; structure: number; depth: number; relevance: number; confidence: number } // 0-10 each
  strengths: string[]
  improvements: string[]
  answers: AnswerReview[]
  nextSteps: string[]
}

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type", { enum: INTERVIEW_TYPES }).notNull(),
    mode: text("mode", { enum: INTERVIEW_MODES }).default("text").notNull(),
    targetRole: text("target_role").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    status: text("status", { enum: ["in_progress", "completed"] }).default("in_progress").notNull(),
    turns: jsonb("turns").$type<InterviewTurn[]>().default([]).notNull(),
    report: jsonb("report").$type<InterviewReport>(),
    overallScore: integer("overall_score"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("interviews_user_started_idx").on(t.userId, t.startedAt)],
)

export type Interview = typeof interviews.$inferSelect
