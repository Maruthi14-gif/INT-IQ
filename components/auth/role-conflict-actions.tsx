"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { runAuth } from "@/lib/auth/errors"

export function RoleConflictActions() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const result = await runAuth(() => authClient.signOut())
    if (!result.ok) {
      setSigningOut(false)
      toast.error("Couldn't sign out. Please try again.")
      return
    }
    router.replace("/sign-in")
    router.refresh()
  }

  return (
    <Button type="button" variant="outline" onClick={signOut} disabled={signingOut}>
      {signingOut ? "Signing out…" : "Sign out and use another Google account"}
    </Button>
  )
}
