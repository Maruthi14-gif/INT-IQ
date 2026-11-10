"use client"

import { Loader2Icon, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

/** Resolves a live invitation to the authenticated candidate/recruiter-only room. */
export function JoinLiveInterviewButton({ invitationId, label = "Join live room", compact = false }: { invitationId: string; label?: string; compact?: boolean }) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)

  async function join() {
    setJoining(true)
    try {
      const res = await fetch("/api/live-interviews/from-invitation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't open the live interview room.")
      router.push(`/live-interviews/${data.id}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Couldn't open the live interview room.")
      setJoining(false)
    }
  }

  return (
    <Button type="button" variant={compact ? "outline" : "default"} className={compact ? "h-9 shrink-0 px-3" : "h-10 px-4"} onClick={join} disabled={joining}>
      {joining ? <Loader2Icon className="animate-spin" /> : <VideoIcon />}
      {joining ? "Opening room…" : label}
    </Button>
  )
}
