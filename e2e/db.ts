import { Client } from "pg"

/**
 * Direct database access for seeding test data. Only for the Neon test branch:
 * it refuses to run when the configured branch is missing or is "production".
 */
export async function withTestDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const branch = process.env.NEON_BRANCH
  if (!branch || branch === "production") throw new Error("withTestDb only runs against the Neon test branch (.env.test.local).")
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}
