import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/**
 * Neon Postgres via node-postgres, the recommended driver on Vercel (Fluid compute).
 * DATABASE_URL is Neon's pooled connection string; migrations use the direct one
 * (DATABASE_URL_UNPOOLED) in drizzle.config.ts.
 */
function connectionString() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn("[db] DATABASE_URL is not set. Run `neon env pull` or add it to .env.local")
    return undefined
  }
  // pg already treats sslmode=require as verify-full; say so explicitly to avoid its warning.
  return url.replace("sslmode=require", "sslmode=verify-full")
}

function createPool() {
  const pool = new Pool({
    connectionString: connectionString(),
    max: 10,
    idleTimeoutMillis: 10_000, // close idle connections before Neon does
    maxLifetimeSeconds: 60, // recycle connections so none go stale
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  })
  // A connection Neon closes while it sits idle in the pool emits 'error' here.
  // Without a listener that would crash the server process.
  pool.on("error", (err) => console.warn("[db] idle connection closed:", err.message))
  return pool
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool }

const pool = globalForDb.pgPool ?? createPool()

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool

// On Vercel, closes idle connections before the function is suspended. No-op elsewhere.
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
