import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { USER_ROLES, type UserRole } from "@/lib/db/schema"

const COOKIE_NAME = "intiq_role_intent"
const COOKIE_MAX_AGE = 10 * 60

function cookieSecret() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret) throw new Error("NEON_AUTH_COOKIE_SECRET is required to secure role selection.")
  return secret
}

function sign(payload: string) {
  return createHmac("sha256", cookieSecret()).update(payload).digest("base64url")
}

export async function saveRoleIntent(role: UserRole) {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000
  const payload = `${role}:${expiresAt}`
  const value = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`
  const jar = await cookies()
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function consumeRoleIntent(): Promise<UserRole | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  jar.delete(COOKIE_NAME)
  if (!token) return null

  const [encodedPayload, providedSignature, ...extra] = token.split(".")
  if (!encodedPayload || !providedSignature || extra.length > 0) return null

  let payload: string
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8")
  } catch {
    return null
  }

  const expectedSignature = sign(payload)
  const provided = Buffer.from(providedSignature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  const separator = payload.lastIndexOf(":")
  const role = payload.slice(0, separator)
  const expiresAt = Number(payload.slice(separator + 1))
  if (!USER_ROLES.some((candidate) => candidate === role) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return null
  }
  return role as UserRole
}
