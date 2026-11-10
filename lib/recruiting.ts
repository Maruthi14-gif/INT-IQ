import "server-only"
import { and, count, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { authUsers } from "@/lib/db/neon-auth"
import { withRetry } from "@/lib/db/retry"
import {
  applications,
  interviews,
  invitations,
  jobs,
  liveInterviewSessions,
  profiles,
  type ApplicationStatus,
  type ExperienceLevel,
  type InterviewType,
  type InvitationKind,
  type JobStatus,
} from "@/lib/db/schema"

/*
 * Recruiting data access. Every recruiter function takes the recruiter's id and only
 * touches jobs they own; every candidate function takes the candidate's id.
 */

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

/* ── Jobs (recruiter) ───────────────────────────────────────── */

export type JobInput = {
  title: string
  company: string
  location: string | null
  experienceLevel: ExperienceLevel
  skills: string[]
  description: string
  responsibilities: string | null
}

export async function createJob(recruiterId: string, data: JobInput) {
  const [row] = await db.insert(jobs).values({ recruiterId, ...data }).returning()
  return row
}

export async function updateJob(recruiterId: string, id: string, data: Partial<JobInput> & { status?: JobStatus }) {
  if (!isUuid(id)) return null
  const [row] = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), eq(jobs.recruiterId, recruiterId)))
    .returning()
  return row ?? null
}

export async function getRecruiterJob(recruiterId: string, id: string) {
  if (!isUuid(id)) return null
  const [row] = await withRetry(() =>
    db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.recruiterId, recruiterId))).limit(1),
  )
  return row ?? null
}

export async function listRecruiterJobs(recruiterId: string) {
  return withRetry(() =>
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        status: jobs.status,
        createdAt: jobs.createdAt,
        applicants: count(applications.id),
      })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(eq(jobs.recruiterId, recruiterId))
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt)),
  )
}

export type RecruiterJobSummary = Awaited<ReturnType<typeof listRecruiterJobs>>[number]

/** Real counts for the recruiter dashboard. */
export async function recruiterStats(recruiterId: string) {
  const [row] = await withRetry(() =>
    db
      .select({
        activeJobs: sql<number>`count(distinct ${jobs.id}) filter (where ${jobs.status} = 'open')`.mapWith(Number),
        applicants: sql<number>`count(distinct ${applications.id})`.mapWith(Number),
        pending: sql<number>`count(distinct ${applications.id}) filter (where ${applications.status} in ('applied', 'reviewing'))`.mapWith(Number),
        scheduled: sql<number>`count(distinct ${invitations.id}) filter (where ${invitations.kind} = 'live' and ${invitations.status} in ('pending', 'accepted'))`.mapWith(Number),
        completed: sql<number>`count(distinct ${invitations.id}) filter (where ${invitations.status} = 'completed')`.mapWith(Number),
      })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .leftJoin(invitations, eq(invitations.applicationId, applications.id))
      .where(eq(jobs.recruiterId, recruiterId)),
  )
  return row
}

/* ── Applicants (recruiter) ─────────────────────────────────── */

export async function listApplicants(recruiterId: string, jobId: string) {
  if (!isUuid(jobId)) return []
  return withRetry(() =>
    db
      .select({
        id: applications.id,
        status: applications.status,
        createdAt: applications.createdAt,
        candidateId: applications.candidateId,
        name: authUsers.name,
        email: authUsers.email,
        targetRole: profiles.targetRole,
        experienceLevel: profiles.experienceLevel,
        hasResume: sql<boolean>`${profiles.resumeText} is not null`.mapWith(Boolean),
        invitations: count(invitations.id),
      })
      .from(applications)
      .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.recruiterId, recruiterId)))
      .innerJoin(authUsers, eq(authUsers.id, applications.candidateId))
      .leftJoin(profiles, eq(profiles.userId, applications.candidateId))
      .leftJoin(invitations, eq(invitations.applicationId, applications.id))
      .where(eq(applications.jobId, jobId))
      .groupBy(applications.id, authUsers.name, authUsers.email, profiles.targetRole, profiles.experienceLevel, profiles.resumeText)
      .orderBy(desc(applications.createdAt)),
  )
}

export type ApplicantRow = Awaited<ReturnType<typeof listApplicants>>[number]

/** One application with the candidate's profile, invitations and linked AI interviews. Recruiter must own the job. */
export async function getApplicationForRecruiter(recruiterId: string, applicationId: string) {
  if (!isUuid(applicationId)) return null
  const [row] = await withRetry(() =>
    db
      .select({ application: applications, job: jobs, candidate: { name: authUsers.name, email: authUsers.email }, profile: profiles })
      .from(applications)
      .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.recruiterId, recruiterId)))
      .innerJoin(authUsers, eq(authUsers.id, applications.candidateId))
      .leftJoin(profiles, eq(profiles.userId, applications.candidateId))
      .where(eq(applications.id, applicationId))
      .limit(1),
  )
  if (!row) return null
  const [invites, linkedInterviews] = await Promise.all([
    db.select().from(invitations).where(eq(invitations.applicationId, applicationId)).orderBy(desc(invitations.createdAt)),
    db
      .select({
        id: interviews.id,
        type: interviews.type,
        mode: interviews.mode,
        status: interviews.status,
        overallScore: interviews.overallScore,
        startedAt: interviews.startedAt,
        completedAt: interviews.completedAt,
      })
      .from(interviews)
      .where(eq(interviews.applicationId, applicationId))
      .orderBy(desc(interviews.startedAt)),
  ])
  const liveSessions = await db
    .select({ invitationId: liveInterviewSessions.invitationId, status: liveInterviewSessions.status, completedAt: liveInterviewSessions.completedAt, finalEvaluation: liveInterviewSessions.finalEvaluation })
    .from(liveInterviewSessions)
    .where(eq(liveInterviewSessions.applicationId, applicationId))
  return { ...row, invitations: invites, interviews: linkedInterviews, liveSessions }
}

export async function updateApplication(
  recruiterId: string,
  applicationId: string,
  data: { status?: ApplicationStatus; recruiterNotes?: string | null },
) {
  if (!isUuid(applicationId)) return null
  // Ownership check through the job.
  const owned = db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.recruiterId, recruiterId)))
    .where(eq(applications.id, applicationId))
  const [row] = await db.update(applications).set(data).where(inArray(applications.id, owned)).returning()
  return row ?? null
}

/** A recruiter may read the full report of an AI interview linked to one of their applications. */
export async function getInterviewForRecruiter(recruiterId: string, interviewId: string) {
  if (!isUuid(interviewId)) return null
  const [row] = await withRetry(() =>
    db
      .select({ interview: interviews, candidate: { name: authUsers.name, email: authUsers.email }, job: { id: jobs.id, title: jobs.title } })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.recruiterId, recruiterId)))
      .innerJoin(authUsers, eq(authUsers.id, interviews.userId))
      .where(eq(interviews.id, interviewId))
      .limit(1),
  )
  return row ?? null
}

/* ── Invitations (recruiter) ────────────────────────────────── */

export async function createInvitation(
  recruiterId: string,
  applicationId: string,
  data: { kind: InvitationKind; interviewType?: InterviewType; totalQuestions?: number; scheduledAt?: Date; message?: string | null },
) {
  const app = await getApplicationForRecruiter(recruiterId, applicationId)
  if (!app) return null
  const [row] = await db
    .insert(invitations)
    .values({
      applicationId,
      kind: data.kind,
      interviewType: data.interviewType ?? null,
      totalQuestions: data.totalQuestions ?? null,
      scheduledAt: data.scheduledAt ?? null,
      message: data.message ?? null,
    })
    .returning()
  if (data.kind === "live") {
    await db.insert(liveInterviewSessions).values({
      invitationId: row.id,
      applicationId: app.application.id,
      recruiterId: app.job.recruiterId,
      candidateId: app.application.candidateId,
    })
  }
  // Inviting moves the application forward.
  if (app.application.status === "applied" || app.application.status === "reviewing") {
    await db.update(applications).set({ status: "interviewing" }).where(eq(applications.id, applicationId))
  }
  return row
}

/* ── Candidate side ─────────────────────────────────────────── */

export async function listOpenJobs(candidateId: string) {
  return withRetry(() =>
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        experienceLevel: jobs.experienceLevel,
        skills: jobs.skills,
        createdAt: jobs.createdAt,
        applicationId: applications.id,
        applicationStatus: applications.status,
      })
      .from(jobs)
      .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.candidateId, candidateId)))
      .where(eq(jobs.status, "open"))
      .orderBy(desc(jobs.createdAt)),
  )
}

export type OpenJob = Awaited<ReturnType<typeof listOpenJobs>>[number]

export async function getOpenJob(candidateId: string, jobId: string) {
  if (!isUuid(jobId)) return null
  const [row] = await withRetry(() =>
    db
      .select({ job: jobs, applicationId: applications.id, applicationStatus: applications.status })
      .from(jobs)
      .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.candidateId, candidateId)))
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "open")))
      .limit(1),
  )
  return row ?? null
}

export async function applyToJob(
  candidateId: string,
  jobId: string,
  coverNote: string | null,
): Promise<{ id: string } | "exists" | null> {
  if (!isUuid(jobId)) return null
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "open"))).limit(1)
  if (!job) return null
  const [row] = await db
    .insert(applications)
    .values({ jobId, candidateId, coverNote })
    .onConflictDoNothing()
    .returning({ id: applications.id })
  return row ?? "exists"
}

/** The candidate's applications with their job and any invitations. */
export async function listMyApplications(candidateId: string) {
  const rows = await withRetry(() =>
    db
      .select({
        id: applications.id,
        status: applications.status,
        createdAt: applications.createdAt,
        job: { id: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location },
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(eq(applications.candidateId, candidateId))
      .orderBy(desc(applications.createdAt)),
  )
  if (rows.length === 0) return []
  const invites = await db
    .select()
    .from(invitations)
    .where(inArray(invitations.applicationId, rows.map((r) => r.id)))
    .orderBy(desc(invitations.createdAt))
  return rows.map((r) => ({ ...r, invitations: invites.filter((i) => i.applicationId === r.id) }))
}

export type MyApplication = Awaited<ReturnType<typeof listMyApplications>>[number]

/** Invitations the candidate hasn't finished, for the dashboard. */
export async function listPendingInvitations(candidateId: string) {
  return withRetry(() =>
    db
      .select({ id: invitations.id, kind: invitations.kind, status: invitations.status, scheduledAt: invitations.scheduledAt, jobTitle: jobs.title, company: jobs.company })
      .from(invitations)
      .innerJoin(applications, and(eq(applications.id, invitations.applicationId), eq(applications.candidateId, candidateId)))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(inArray(invitations.status, ["pending", "accepted"]))
      .orderBy(desc(invitations.createdAt))
      .limit(5),
  )
}

/** An invitation the candidate owns (through their application). */
export async function getMyInvitation(candidateId: string, invitationId: string) {
  if (!isUuid(invitationId)) return null
  const [row] = await withRetry(() =>
    db
      .select({ invitation: invitations, application: applications, job: jobs })
      .from(invitations)
      .innerJoin(applications, and(eq(applications.id, invitations.applicationId), eq(applications.candidateId, candidateId)))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(eq(invitations.id, invitationId))
      .limit(1),
  )
  return row ?? null
}

/** Links the AI interview the candidate just started to its invitation. */
export async function attachInterviewToInvitation(invitationId: string, interviewId: string) {
  await db.update(invitations).set({ interviewId, status: "accepted" }).where(eq(invitations.id, invitationId))
}

/** Called when an invited AI interview completes. */
export async function completeInvitationForInterview(interviewId: string) {
  await db.update(invitations).set({ status: "completed" }).where(eq(invitations.interviewId, interviewId))
}

/* ── Role ───────────────────────────────────────────────────── */

export async function setRole(userId: string, role: "student" | "recruiter") {
  await db.update(profiles).set({ role, roleChosen: true }).where(eq(profiles.userId, userId))
}
