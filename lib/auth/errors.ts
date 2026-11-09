/**
 * Neon Auth's browser client throws on a non-OK response (wrong code, rate limit,
 * network error) and can also return `{ error }`. These helpers turn both into a
 * short message for the UI, so a failed call never leaves a spinner running.
 */

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown; error?: unknown }

function details(err: unknown) {
  const e = (err && typeof err === "object" ? err : {}) as ErrorLike
  // Thrown errors carry the raw Better Auth response body in `.error`.
  const body = e.error && typeof e.error === "object" ? (e.error as ErrorLike) : undefined
  const code = body?.code ?? e.code
  const status = body?.status ?? e.status
  const message = body?.message ?? e.message
  return {
    code: typeof code === "string" ? code : undefined,
    status: typeof status === "number" ? status : undefined,
    message: typeof message === "string" ? message : undefined,
  }
}

export function friendlyAuthError(err: unknown) {
  const { code, status, message } = details(err)
  if (status === 429) return "Too many tries. Please wait a minute and try again."
  switch (code) {
    case "INVALID_OTP":
      return "That code isn't right. Check your email and try again."
    case "OTP_EXPIRED":
      return "That code has expired. Send a new one."
    case "TOO_MANY_ATTEMPTS":
      return "Too many wrong codes. Send a new one."
  }
  if (err instanceof TypeError) return "Can't reach the server. Check your connection and try again."
  return message || "Something went wrong. Please try again."
}

/** Runs an auth call. Never throws: returns `{ ok: true }` or `{ ok: false, message }`. */
export async function runAuth(call: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await call()
    const error = result && typeof result === "object" && "error" in result ? (result as { error?: unknown }).error : null
    return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true }
  } catch (err) {
    return { ok: false, message: friendlyAuthError(err) }
  }
}
