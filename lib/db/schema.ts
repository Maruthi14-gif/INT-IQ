import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import type { IntegrityLog } from "../integrity"
import { COMPANY_INDUSTRIES, COMPANY_SIZES, type CompanyIndustry, type CompanySize } from "../company-options"
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

/* ── Recruiter verification ─────────────────────────────────── */

export const RECRUITER_STATUSES = ["pending", "approved", "rejected"] as const
export type RecruiterStatus = (typeof RECRUITER_STATUSES)[number]

/** What the automatic email check found when the recruiter asked for approval. Admins only. */
export type RecruiterEmailCheck = {
  domain: string
  /** Gmail, Yahoo, Outlook and other personal mail. */
  freeMail: boolean
  /** A throwaway inbox (Kickbox Open). Null when the check couldn't run. */
  disposable: boolean | null
  /** The email domain belongs to the company website. Null without a website. */
  matchesWebsite: boolean | null
  /** The sign-in proved the person owns this address (Google or email code). Missing on older checks. */
  verified?: boolean
  checkedAt: string
}

/* ── Companies ──────────────────────────────────────────────── */

// Kept in a file without database code so the browser form can import the lists too.
export { COMPANY_INDUSTRIES, COMPANY_SIZES, type CompanyIndustry, type CompanySize }

/** Facts INT-IQ checked about a company on the open internet. Re-run each time a recruiter submits it. */
export type CompanyCheck = {
  domain: string
  /** The domain resolves in DNS or is registered (RDAP). False means no such company website. */
  domainExists: boolean
  website: { reachable: boolean; status: number | null; title: string | null }
  /** From RDAP (the domain registry). Null when the registry didn't say. */
  domainRegisteredAt: string | null
  /** The domain has mail servers (MX), as a real business usually does. */
  mailServer: boolean | null
  /** The website's title or text mentions the company name. */
  nameOnWebsite: boolean | null
  /** A public record (Wikidata) whose official website is this domain. */
  publicRecord: { id: string; label: string } | null
  /** Indian GST number, if given: check digit and, with GSTIN_API_KEY, the registry. */
  gst: {
    gstin: string
    formatValid: boolean
    registry: { status: string; legalName: string; nameMatches: boolean } | null
  } | null
  checkedAt: string
}

/**
 * One row per company, keyed by its web domain, shared by every recruiter from that company.
 * Candidates will see this profile on job pages.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Registrable domain, lower case, e.g. "infosys.com". */
    domain: text("domain").notNull(),
    website: text("website").notNull(),
    industry: text("industry", { enum: COMPANY_INDUSTRIES }),
    size: text("size", { enum: COMPANY_SIZES }),
    headquarters: text("headquarters"),
    linkedinUrl: text("linkedin_url"),
    gstin: text("gstin"),
    about: text("about"),
    check: jsonb("check").$type<CompanyCheck>(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("companies_domain_idx").on(t.domain)],
)

export type Company = typeof companies.$inferSelect

/**
 * Recruiter verification, one row per recruiter account. A recruiter can draft jobs right
 * away; publishing jobs and seeing candidates waits until an admin approves them.
 */
export const recruiterProfiles = pgTable(
  "recruiter_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: RECRUITER_STATUSES }).default("pending").notNull(),
    /** The company this recruiter hires for, once they've sent its details. */
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    /** What the recruiter typed, kept as submitted. The checked profile lives in `companies`. */
    companyName: text("company_name"),
    companyWebsite: text("company_website"),
    jobTitle: text("job_title"),
    linkedinUrl: text("linkedin_url"),
    /** Anything the recruiter wants the reviewer to know. */
    note: text("note"),
    emailCheck: jsonb("email_check").$type<RecruiterEmailCheck>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => authUsers.id, { onDelete: "set null" }),
    /** Shown to the recruiter when a request is declined. */
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("recruiter_profiles_status_idx").on(t.status, t.submittedAt), index("recruiter_profiles_company_idx").on(t.companyId)],
)

export type RecruiterProfile = typeof recruiterProfiles.$inferSelect

/* ── Rate limits ────────────────────────────────────────────── */

/** Fixed-window request counters, one row per user and action, so nobody can drain the AI quota. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
  count: integer("count").default(0).notNull(),
})

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
 * "live": a scheduled human-to-human interview with a private WebRTC room.
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

/* ── Live interviews ────────────────────────────────────────────────────── */

export const LIVE_INTERVIEW_STATUSES = ["scheduled", "waiting", "active", "completed", "cancelled"] as const
export type LiveInterviewStatus = (typeof LIVE_INTERVIEW_STATUSES)[number]

/** A consented text segment. Audio and video are never recorded by INT-IQ. */
export type LiveTranscriptTurn = {
  speaker: "recruiter" | "candidate"
  text: string
  createdAt: string
}

/** The recruiter-only preparation prepared by Gemini from the job and resume. */
export type CopilotPlan = {
  focusAreas: string[]
  verificationSkills: string[]
  projectQuestions: string[]
  interviewPlan: { stage: string; aim: string; questions: string[] }[]
}

/** A recruiter can edit this draft before explicitly approving it. It never changes an application status. */
export type LiveInterviewEvaluation = {
  summary: string
  strengths: string[]
  weaknesses: string[]
  evidence: string[]
  recommendation: string
  approvedAt: string
}

/**
 * One private room per live invitation. Browser media connects directly with WebRTC;
 * this table contains only room state, consented text, notes and the final evaluation.
 */
export const liveInterviewSessions = pgTable(
  "live_interview_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: LIVE_INTERVIEW_STATUSES }).default("scheduled").notNull(),
    recruiterJoinedAt: timestamp("recruiter_joined_at", { withTimezone: true }),
    candidateJoinedAt: timestamp("candidate_joined_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Each participant must consent before their browser may save any transcription. */
    recruiterTranscriptionConsentAt: timestamp("recruiter_transcription_consent_at", { withTimezone: true }),
    candidateTranscriptionConsentAt: timestamp("candidate_transcription_consent_at", { withTimezone: true }),
    transcript: jsonb("transcript").$type<LiveTranscriptTurn[]>().default([]).notNull(),
    copilotPlan: jsonb("copilot_plan").$type<CopilotPlan>(),
    recruiterNotes: text("recruiter_notes"),
    finalEvaluation: jsonb("final_evaluation").$type<LiveInterviewEvaluation>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("live_interview_sessions_invitation_idx").on(t.invitationId),
    index("live_interview_sessions_application_idx").on(t.applicationId),
    index("live_interview_sessions_candidate_idx").on(t.candidateId),
  ],
)

export type LiveInterviewSession = typeof liveInterviewSessions.$inferSelect

export const LIVE_SIGNAL_KINDS = ["offer", "answer", "ice"] as const
export type LiveSignalKind = (typeof LIVE_SIGNAL_KINDS)[number]

/** Short-lived WebRTC offer/answer/ICE messages; no media is sent through this table. */
export const liveInterviewSignals = pgTable(
  "live_interview_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveInterviewSessions.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LIVE_SIGNAL_KINDS }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("live_interview_signals_session_idx").on(t.sessionId, t.createdAt)],
)

export type LiveInterviewSignal = typeof liveInterviewSignals.$inferSelect
