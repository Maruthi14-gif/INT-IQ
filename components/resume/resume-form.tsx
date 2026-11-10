"use client"

import { CheckIcon, FileTextIcon, Loader2Icon, SparklesIcon, TriangleAlertIcon, UploadIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ExperienceLevel, ResumeInsights } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export type ResumeProfile = {
  targetRole: string | null
  experienceLevel: ExperienceLevel | null
  jobDescription: string | null
  resumeFileName: string | null
  hasResume: boolean
  resumeInsights: ResumeInsights | null
}

const LEVELS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: "fresher", label: "Student / fresher", hint: "Campus placements, internships" },
  { value: "junior", label: "0–2 years", hint: "Junior roles" },
  { value: "mid", label: "2–5 years", hint: "Mid-level roles" },
]

const ROLE_IDEAS = ["Software Developer", "Frontend Developer", "Data Analyst", "Java Developer", "ML Engineer"]

export function ResumeForm({ initial }: { initial: ResumeProfile }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState(initial)
  const [targetRole, setTargetRole] = useState(initial.targetRole ?? "")
  const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel ?? "fresher")
  const [jobDescription, setJobDescription] = useState(initial.jobDescription ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasted, setPasted] = useState("")
  const [showJd, setShowJd] = useState(Boolean(initial.jobDescription))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!targetRole.trim()) return setError("Add the role you're preparing for.")
    const form = new FormData()
    form.set("targetRole", targetRole.trim())
    form.set("experienceLevel", level)
    form.set("jobDescription", jobDescription)
    if (file) form.set("file", file)
    if (pasteMode && pasted.trim()) form.set("resumeText", pasted)

    setSaving(true)
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Couldn't save. Please try again.")
        return
      }
      setProfile(data.profile)
      setFile(null)
      setPasted("")
      setPasteMode(false)
      if (data.warning) toast.warning(data.warning)
      else toast.success(data.profile.resumeInsights ? "Resume analyzed" : "Saved")
      router.refresh()
    } catch {
      setError("Can't reach the server. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const insights = profile.resumeInsights

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="targetRole">Role you&rsquo;re preparing for</Label>
          <Input
            id="targetRole"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Frontend Developer"
            className="h-11"
            maxLength={80}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ROLE_IDEAS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTargetRole(r)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Experience</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={level === l.value}
                onClick={() => setLevel(l.value)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  level === l.value ? "border-brand bg-brand-soft" : "hover:bg-accent",
                )}
              >
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Resume</Label>
            <button
              type="button"
              onClick={() => setPasteMode((p) => !p)}
              className="text-xs font-medium text-brand-text hover:opacity-80"
            >
              {pasteMode ? "Upload a PDF instead" : "Paste text instead"}
            </button>
          </div>
          {pasteMode ? (
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste your resume text here"
              className="min-h-40"
              aria-label="Resume text"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setFile(f)
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors hover:bg-accent/50"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                {file ? <FileTextIcon className="size-5" /> : <UploadIcon className="size-5" />}
              </span>
              {file ? (
                <span className="text-sm font-medium">{file.name}</span>
              ) : (
                <>
                  <span className="text-sm font-medium">Click or drop your resume PDF</span>
                  <span className="text-xs text-muted-foreground">
                    {profile.hasResume
                      ? `Current: ${profile.resumeFileName ?? "pasted text"}. Upload again to replace it.`
                      : "PDF up to 4 MB"}
                  </span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf,.txt"
            className="sr-only"
            aria-label="Resume file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-2">
          {showJd ? (
            <>
              <Label htmlFor="jd">Job description (optional)</Label>
              <Textarea
                id="jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job post to get questions matched to it"
                className="min-h-28"
              />
            </>
          ) : (
            <button type="button" onClick={() => setShowJd(true)} className="text-sm font-medium text-brand-text hover:opacity-80">
              + Add a job description for sharper questions
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="h-11 w-full text-[15px]" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {saving ? "Reading and analyzing…" : "Save and analyze"}
        </Button>
      </form>

      <section className="rounded-2xl border bg-card p-6" aria-labelledby="insights-title">
        <h2 id="insights-title" className="font-medium">
          What the AI sees
        </h2>
        {insights ? (
          <div className="mt-4 space-y-6">
            <p className="text-sm leading-relaxed text-muted-foreground">{insights.summary}</p>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Skills</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {insights.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            {insights.projects.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Projects it will ask about</h3>
                <ul className="mt-2 space-y-2">
                  {insights.projects.map((p) => (
                    <li key={p.name} className="rounded-xl border px-3 py-2 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground"> — {p.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Strengths</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {insights.strengths.map((s) => (
                    <li key={s} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">To work on</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {insights.gaps.map((g) => (
                    <li key={g} className="flex gap-2">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button asChild variant="outline" className="h-10 w-full">
              <Link href="/interview">Practice with these questions</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
              <SparklesIcon className="size-5" />
            </span>
            <p className="mt-4 font-medium">No resume yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add your resume and the interviewer will ask about your own projects and skills.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
