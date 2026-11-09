/**
 * Neon can drop a pooled connection (scale-to-zero, proxy restarts, idle cleanup).
 * node-postgres then fails the next query with ECONNRESET. Retrying an idempotent
 * query once on a fresh connection fixes it without the user noticing.
 */
const TRANSIENT_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "57P01", "57P02", "57P03"])
const TRANSIENT_MESSAGE = /ECONNRESET|Connection terminated|terminating connection|connection error|socket hang up/i

function isTransient(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    const { code, message } = e as { code?: unknown; message?: unknown }
    if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true
    if (typeof message === "string" && TRANSIENT_MESSAGE.test(message)) return true
  }
  return false
}

/** Runs an idempotent database call, retrying once if the connection dropped. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= attempts || !isTransient(err)) throw err
      console.warn(`[db] connection dropped, retrying (attempt ${attempt + 1} of ${attempts})`)
    }
  }
}
