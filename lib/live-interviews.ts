import "server-only"
import { and, desc, eq, ne, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { authUsers } from "@/lib/db/neon-auth"
import { withRetry } from "@/lib/db/retry"
import {
  applications,
  invitations,
  jobs,
  liveInterviewSessions,
  liveInterviewSignals,
  profiles,
  type CopilotPlan,
  type LiveInterviewEvaluation,
  type LiveInterviewSignal,
  type LiveSignalKind,
  type LiveTranscriptTurn,
} from "@/lib/db/schema"

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value)

export type LiveParticipantRole = "recruiter" | "candidate"

/** A live room plus only the data either participant is allowed to see on the server. */
export async function getLiveInterviewForUser(userId: string, sessionId: string) {
  if (!isUuid(sessionId)) return null
  const [row] = await withRetry(() =>
    db
      .select({
        session: liveInterviewSessions,
        invitation: invitations,
        application: applications,
        job: { id: jobs.id, title: jobs.title, company: jobs.company, description: jobs.description, skills: jobs.skills, responsibilities: jobs.responsibilities },
        candidate: { id: authUsers.id, name: authUsers.name, email: authUsers.email },
        profile: profiles,
      })
      .from(liveInterviewSessions)
      .innerJoin(invitations, eq(invitations.id, liveInterviewSessions.invitationId))
      .innerJoin(applications, eq(applications.id, liveInterviewSessions.applicationId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(authUsers, eq(authUsers.id, liveInterviewSessions.candidateId))
      .leftJoin(profiles, eq(profiles.userId, liveInterviewSessions.candidateId))
      .where(
        and(
          eq(liveInterviewSessions.id, sessionId),
          or(eq(liveInterviewSessions.recruiterId, userId), eq(liveInterviewSessions.candidateId, userId)),
        ),
      )
      .limit(1),
  )
  if (!row) return null
  return { ...row, role: (row.session.recruiterId === userId ? "recruiter" : "candidate") as LiveParticipantRole }
}

/**
 * Resolves an invitation to its private room. This also backfills rooms for any live
 * invitations created before the room feature was deployed.
 */
export async function ensureLiveInterviewForInvitation(userId: string, invitationId: string) {
  if (!isUuid(invitationId)) return null
  const [source] = await withRetry(() =>
    db
      .select({
        invitationId: invitations.id,
        kind: invitations.kind,
        applicationId: applications.id,
        candidateId: applications.candidateId,
        recruiterId: jobs.recruiterId,
      })
      .from(invitations)
      .innerJoin(applications, eq(applications.id, invitations.applicationId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(
        and(
          eq(invitations.id, invitationId),
          or(eq(applications.candidateId, userId), eq(jobs.recruiterId, userId)),
        ),
      )
      .limit(1),
  )
  if (!source || source.kind !== "live") return null

  await db
    .insert(liveInterviewSessions)
    .values({
      invitationId: source.invitationId,
      applicationId: source.applicationId,
      recruiterId: source.recruiterId,
      candidateId: source.candidateId,
    })
    .onConflictDoNothing({ target: liveInterviewSessions.invitationId })

  const [session] = await withRetry(() =>
    db.select({ id: liveInterviewSessions.id }).from(liveInterviewSessions).where(eq(liveInterviewSessions.invitationId, invitationId)).limit(1),
  )
  return session ? getLiveInterviewForUser(userId, session.id) : null
}

export async function markLiveInterviewJoined(userId: string, sessionId: string) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.session.status === "completed" || room.session.status === "cancelled") return null
  const now = new Date()
  const recruiter = room.role === "recruiter"
  const otherJoined = recruiter ? room.session.candidateJoinedAt : room.session.recruiterJoinedAt
  const update = recruiter
    ? { recruiterJoinedAt: now, status: otherJoined ? "active" as const : "waiting" as const, startedAt: otherJoined && !room.session.startedAt ? now : room.session.startedAt }
    : { candidateJoinedAt: now, status: otherJoined ? "active" as const : "waiting" as const, startedAt: otherJoined && !room.session.startedAt ? now : room.session.startedAt }
  await db.update(liveInterviewSessions).set(update).where(eq(liveInterviewSessions.id, sessionId))
  await db.update(invitations).set({ status: "accepted" }).where(and(eq(invitations.id, room.invitation.id), eq(invitations.status, "pending")))
  return getLiveInterviewForUser(userId, sessionId)
}

export async function setLiveTranscriptionConsent(userId: string, sessionId: string, consented: boolean) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room) return null
  const update = room.role === "recruiter"
    ? { recruiterTranscriptionConsentAt: consented ? new Date() : null }
    : { candidateTranscriptionConsentAt: consented ? new Date() : null }
  await db.update(liveInterviewSessions).set(update).where(eq(liveInterviewSessions.id, sessionId))
  return getLiveInterviewForUser(userId, sessionId)
}

export async function appendLiveTranscript(userId: string, sessionId: string, text: string) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || !room.session.recruiterTranscriptionConsentAt || !room.session.candidateTranscriptionConsentAt) return null
  const turn: LiveTranscriptTurn = { speaker: room.role, text, createdAt: new Date().toISOString() }
  // JSONB append avoids losing a simultaneous line sent by the other participant.
  await db
    .update(liveInterviewSessions)
    .set({ transcript: sql<LiveTranscriptTurn[]>`coalesce(${liveInterviewSessions.transcript}, '[]'::jsonb) || ${JSON.stringify([turn])}::jsonb` })
    .where(eq(liveInterviewSessions.id, sessionId))
  return turn
}

export async function saveLiveRecruiterNotes(userId: string, sessionId: string, notes: string) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.role !== "recruiter") return null
  await db.update(liveInterviewSessions).set({ recruiterNotes: notes || null }).where(eq(liveInterviewSessions.id, sessionId))
  return true
}

export async function saveCopilotPlan(userId: string, sessionId: string, plan: CopilotPlan) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.role !== "recruiter") return null
  await db.update(liveInterviewSessions).set({ copilotPlan: plan }).where(eq(liveInterviewSessions.id, sessionId))
  return true
}

export async function saveLiveEvaluation(userId: string, sessionId: string, evaluation: LiveInterviewEvaluation) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.role !== "recruiter") return null
  await db.update(liveInterviewSessions).set({ finalEvaluation: evaluation }).where(eq(liveInterviewSessions.id, sessionId))
  return true
}

/** Only the recruiter can formally end the session. This never makes a hiring decision. */
export async function completeLiveInterview(userId: string, sessionId: string) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.role !== "recruiter") return null
  const now = new Date()
  await Promise.all([
    db.update(liveInterviewSessions).set({ status: "completed", completedAt: now }).where(eq(liveInterviewSessions.id, sessionId)),
    db.update(invitations).set({ status: "completed" }).where(eq(invitations.id, room.invitation.id)),
  ])
  return true
}

/** Store an SDP or ICE candidate after verifying the sender owns this private room. */
export async function sendLiveSignal(userId: string, sessionId: string, kind: LiveSignalKind, payload: Record<string, unknown>) {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room || room.session.status === "completed" || room.session.status === "cancelled") return null
  const [signal] = await db.insert(liveInterviewSignals).values({ sessionId, senderId: userId, kind, payload }).returning()
  return signal
}

/** Signals only from the other participant; messages are bounded and client de-duplicated. */
export async function getLiveSignals(userId: string, sessionId: string): Promise<LiveInterviewSignal[] | null> {
  const room = await getLiveInterviewForUser(userId, sessionId)
  if (!room) return null
  const signals = await withRetry(() =>
    db
      .select()
      .from(liveInterviewSignals)
      .where(and(eq(liveInterviewSignals.sessionId, sessionId), ne(liveInterviewSignals.senderId, userId)))
      .orderBy(desc(liveInterviewSignals.createdAt))
      .limit(160),
  )
  return signals.reverse()
}
