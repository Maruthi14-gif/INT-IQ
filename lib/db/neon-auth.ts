import { pgSchema, text, uuid } from "drizzle-orm/pg-core"

/**
 * Neon Auth's user table (schema `neon_auth`), owned and migrated by Neon.
 * Declared here only so app tables can reference it. This file is NOT listed
 * in drizzle.config.ts, so drizzle-kit never tries to create or alter it.
 */
const neonAuth = pgSchema("neon_auth")

export const authUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image"),
})
