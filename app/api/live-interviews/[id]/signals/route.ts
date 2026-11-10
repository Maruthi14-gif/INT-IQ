import { z } from "zod"
import { apiUser, jsonError } from "@/lib/api"
import { LIVE_SIGNAL_KINDS } from "@/lib/db/schema"
import { getLiveSignals, sendLiveSignal } from "@/lib/live-interviews"

const body = z.object({
  kind: z.enum(LIVE_SIGNAL_KINDS),
  payload: z.record(z.string(), z.unknown()),
})

/** Database-backed signaling for the peer-to-peer WebRTC room. Never accepts media. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params
  const signals = await getLiveSignals(user.id, id)
  if (!signals) return jsonError(404, "Live interview room not found.")
  return Response.json({ signals: signals.map((signal) => ({ id: signal.id, kind: signal.kind, payload: signal.payload, createdAt: signal.createdAt.toISOString() })) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser()
  if (!user) return jsonError(401, "Please sign in again.")
  const { id } = await params
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success || JSON.stringify(parsed.data.payload).length > 16_000) return jsonError(400, "Invalid signaling message.")
  const signal = await sendLiveSignal(user.id, id, parsed.data.kind, parsed.data.payload)
  if (!signal) return jsonError(404, "Live interview room is unavailable.")
  return Response.json({ id: signal.id })
}
