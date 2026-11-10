"use client"

import { Loader2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ExperienceLevel, Job } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

const LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "fresher", label: "Fresher / student" },
  { value: "junior", label: "0–2 years" },
  { value: "mid", label: "2–5 years" },
]

type Props = { job?: Job }

/** Create or edit a job. New jobs are saved as drafts; publishing happens on the job page. */
export function JobForm({ job }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(job?.title ?? "")
  const [company, setCompany] = useState(job?.company ?? "")
  const [location, setLocation] = useState(job?.location ?? "")
  const [level, setLevel] = useState<ExperienceLevel>(job?.experienceLevel ?? "fresher")
  const [skills, setSkills] = useState<string[]>(job?.skills ?? [])
  const [skillDraft, setSkillDraft] = useState("")
  const [description, setDescription] = useState(job?.description ?? "")
  const [responsibilities, setResponsibilities] = useState(job?.responsibilities ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSkill() {
    const s = skillDraft.trim().replace(/,$/, "")
    if (s && !skills.some((k) => k.toLowerCase() === s.toLowerCase()) && skills.length < 20) setSkills([...skills, s])
    setSkillDraft("")
  }

  function onSkillKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addSkill()
    } else if (e.key === "Backspace" && !skillDraft && skills.length) {
      setSkills(skills.slice(0, -1))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const body = { title, company, location, experienceLevel: level, skills, description, responsibilities }
    try {
      const res = await fetch(job ? `/api/recruiter/jobs/${job.id}` : "/api/recruiter/jobs", {
        method: job ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the job.")
      toast.success(job ? "Job updated" : "Job saved as a draft")
      router.push(`/recruiter/jobs/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the job.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Intern" className="h-11" maxLength={100} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Labs" className="h-11" maxLength={100} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hyderabad · Remote" className="h-11" maxLength={100} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Experience</legend>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={level === l.value}
                onClick={() => setLevel(l.value)}
                className={cn("rounded-xl border px-3 py-2.5 text-sm transition-colors", level === l.value ? "border-brand bg-brand-soft font-medium" : "hover:bg-accent")}
              >
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Required skills</Label>
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 focus-within:ring-3 focus-within:ring-ring/50">
          {skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-text">
              {s}
              <button type="button" onClick={() => setSkills(skills.filter((k) => k !== s))} aria-label={`Remove ${s}`} className="rounded hover:bg-brand/20">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <input
            id="skills"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={onSkillKey}
            onBlur={addSkill}
            placeholder={skills.length ? "" : "Type a skill and press Enter, e.g. React"}
            className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            maxLength={40}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Job description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the role is, who you're looking for, and what the team works on." className="min-h-36" maxLength={6000} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsibilities">Responsibilities (optional)</Label>
        <Textarea id="responsibilities" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="One per line" className="min-h-28" maxLength={4000} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 px-5" disabled={saving}>
          {saving && <Loader2Icon className="animate-spin" />}
          {job ? "Save changes" : "Save draft"}
        </Button>
        {!job && <p className="text-sm text-muted-foreground">You can publish it on the next screen.</p>}
      </div>
    </form>
  )
}
