import { NextResponse } from "next/server"
import { apiUser, jsonError } from "@/lib/api"
import { consumeRoleIntent } from "@/lib/auth/role-intent"
import { chooseInitialRole, getOrCreateProfile } from "@/lib/profiles"
import { homeFor } from "@/lib/session"

async function complete(request: Request) {
  const user = await apiUser()
  if (!user) return { error: jsonError(401, "Please sign in again.") }

  const requestedRole = await consumeRoleIntent()
  let profile = await getOrCreateProfile(user.id)
  if (!profile.roleChosen) {
    if (!requestedRole) return { next: "/welcome" }
    profile = await chooseInitialRole(user.id, requestedRole)
  }

  if (requestedRole && profile.role !== requestedRole) return { conflict: true }

  const requestedNext = new URL(request.url).searchParams.get("next")
  if (!requestedNext || !requestedNext.startsWith("/") || requestedNext.startsWith("//")) {
    return { next: homeFor(profile.role) }
  }
  const destination = new URL(requestedNext, request.url)
  if (destination.origin !== new URL(request.url).origin) return { next: homeFor(profile.role) }
  return { next: `${destination.pathname}${destination.search}${destination.hash}` }
}

export async function GET(request: Request) {
  const result = await complete(request)
  if ("error" in result) return NextResponse.redirect(new URL("/sign-in", request.url))
  if ("conflict" in result) return NextResponse.redirect(new URL("/auth/role-conflict", request.url))
  return NextResponse.redirect(new URL(result.next, request.url))
}

export async function POST(request: Request) {
  const result = await complete(request)
  if ("error" in result) return result.error
  if ("conflict" in result) return jsonError(409, "This account already has a different workspace.")
  return Response.json({ next: result.next })
}
