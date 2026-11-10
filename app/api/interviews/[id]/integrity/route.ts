import { z } from "zod"
import { apiUserWithRole, jsonError } from "@/lib/api"
import { INTEGRITY_FLAGS } from "@/lib/integrity"
import { getInterview, saveIntegritySession } from "@/lib/interviews"

const ms = z.number().int().min(0).max(6 * 60 * 60 * 1000)
const count = z.number().int().min(0).max(10_000)

const bodySchema = z.object({
  sessionId: z.string().regex(/^[a-z0-9-]{8,64}$/i),
  session: z.object({
    startedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    camera: z.enum(["on", "off", "blocked", "unavailable"]),
    monitoredMs: ms,
    inViewMs: ms,
    flags: z.object(Object.fromEntries(INTEGRITY_FLAGS.map((f) => [f, z.object({ count, ms })])) as Record<
      (typeof INTEGRITY_FLAGS)[number],
      z.ZodObject<{ count: typeof count; ms: typeof ms }>
    >),
    pastes: count,
  }),
})

/** Saves the anti-cheat counts for one browser session of an interview (sent by the interview room). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUserWithRole("student")
  if (!user) return error
  const { id } = await params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, "Invalid integrity data.")

  const interview = await getInterview(user.id, id)
  if (!interview) return jsonError(404, "Interview not found.")
  if (interview.status === "completed") return jsonError(409, "This interview has finished, so its integrity record is locked.")

  const saved = await saveIntegritySession(user.id, id, parsed.data.sessionId, parsed.data.session)
  if (!saved) return jsonError(409, "This interview has finished, so its integrity record is locked.")
  return new Response(null, { status: 204 })
}
