import { auth } from "@/lib/auth/server"

// Forwards every /api/auth/* request to Neon Auth.
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler()
