"use client"

import { BriefcaseIcon, GraduationCapIcon, Loader2Icon, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

const ROLES: { role: UserRole; title: string; body: string; icon: LucideIcon; points: string[] }[] = [
  {
    role: "student",
    title: "I'm preparing for interviews",
    body: "Students and job seekers",
    icon: GraduationCapIcon,
    points: ["Practice AI mock interviews", "Get a report on every answer", "Apply to jobs and take recruiter interviews"],
  },
  {
    role: "recruiter",
    title: "I'm hiring",
    body: "Recruiters and hiring teams",
    icon: BriefcaseIcon,
    points: ["Post jobs and review applicants", "Invite candidates to AI interviews", "Read their interview reports"],
  },
]

/** Fallback role setup for existing accounts that have not completed onboarding. */
export function RoleChooser({ firstName, initialRole }: { firstName: string | null; initialRole: UserRole }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(initialRole)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/profile/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save. Please try again.")
      router.replace(data.next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.")
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{firstName ? `Welcome, ${firstName}` : "Welcome to INT-IQ"}</h1>
        <p className="text-muted-foreground">Choose the workspace for this account. Its role is fixed after setup.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
        {ROLES.map(({ role: r, title, body, icon: Icon, points }) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            data-testid={`role-${r}`}
            className={cn(
              "rounded-2xl border bg-card p-6 text-left transition-colors",
              role === r ? "border-brand ring-3 ring-brand/20" : "hover:bg-accent/50",
            )}
          >
            <span className={cn("grid size-10 place-items-center rounded-xl border", role === r ? "bg-brand text-primary-foreground" : "bg-brand-soft text-brand-text")}>
              <Icon className="size-5" />
            </span>
            <span className="mt-4 block font-medium">{title}</span>
            <span className="block text-sm text-muted-foreground">{body}</span>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-current" />
                  {p}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-center">
        <Button onClick={save} disabled={saving} className="h-11 px-6 text-[15px]">
          {saving && <Loader2Icon className="animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  )
}
