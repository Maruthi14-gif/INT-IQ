import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

// Load .env.local the same way Next.js does.
loadEnvConfig(process.cwd())

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need Neon's direct (non-pooled) connection.
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
  // Only manage our own tables; `neon_auth` belongs to Neon Auth.
  schemaFilter: ["public"],
})
