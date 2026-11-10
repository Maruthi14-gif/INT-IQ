import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import type { IntegrityLog } from "../integrity"
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
  /** False until the user picks student or recruiter on first sign-in. */
  roleChosen: boolean("role_chosen").default(false).notNull(),
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

export type VisualCoachingIssue = {
  code: string
  label: string
  seconds: number
  reminders: number
}

export type InterviewCoaching = {
  camera?: {
    calibrated: boolean
    analyzedSeconds: number
    visiblePercent: number
    issues: VisualCoachingIssue[]
  }
  delivery?: {
    words: number
    wordsPerMinute: number | null
    fillerWords: number
    longPauses: number
  }
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
  /** Deterministic, on-device coaching metrics. They do not affect the AI score. */
  coaching?: InterviewCoaching
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
    /** Anti-cheat counts from the camera and tab checks (lib/integrity.ts). Never video. */
    integrity: jsonb("integrity").$type<IntegrityLog>(),
    overallScore: integer("overall_score"),
    /** Set when a recruiter invited the candidate to this interview for a job. */
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("interviews_user_started_idx").on(t.userId, t.startedAt)],
)

export type Interview = typeof interviews.$inferSelect

/* ── Recruiting: jobs, applications, invitations ───────────── */

export const JOB_STATUSES = ["draft", "open", "closed"] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

/** A job posting owned by a recruiter. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    experienceLevel: text("experience_level", { enum: EXPERIENCE_LEVELS }).default("fresher").notNull(),
    skills: jsonb("skills").$type<string[]>().default([]).notNull(),
    description: text("description").notNull(),
    responsibilities: text("responsibilities"),
    status: text("status", { enum: JOB_STATUSES }).default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("jobs_recruiter_idx").on(t.recruiterId), index("jobs_status_idx").on(t.status)],
)

export type Job = typeof jobs.$inferSelect

export const APPLICATION_STATUSES = ["applied", "reviewing", "interviewing", "shortlisted", "rejected", "hired"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** A candidate applying to a job. One per candidate per job. */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: APPLICATION_STATUSES }).default("applied").notNull(),
    coverNote: text("cover_note"),
    /** Recruiter's private notes about this candidate. Never shown to the candidate. */
    recruiterNotes: text("recruiter_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("applications_job_candidate_idx").on(t.jobId, t.candidateId),
    index("applications_candidate_idx").on(t.candidateId),
  ],
)

export type Application = typeof applications.$inferSelect

export const INVITATION_KINDS = ["ai", "live"] as const
export type InvitationKind = (typeof INVITATION_KINDS)[number]
export const INVITATION_STATUSES = ["pending", "accepted", "completed", "declined", "expired"] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

/**
 * A recruiter inviting a candidate to interview for an application.
 * "ai": the candidate does an INT-IQ AI interview; the report goes to the recruiter.
 * "live": a scheduled human-to-human interview (room not built yet; details only).
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: INVITATION_KINDS }).notNull(),
    status: text("status", { enum: INVITATION_STATUSES }).default("pending").notNull(),
    /** AI interviews: which round and how many questions. */
    interviewType: text("interview_type", { enum: INTERVIEW_TYPES }),
    totalQuestions: integer("total_questions"),
    /** Live interviews: when. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    message: text("message"),
    /** The AI interview the candidate did for this invitation. */
    interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("invitations_application_idx").on(t.applicationId)],
)

export type Invitation = typeof invitations.$inferSelect
