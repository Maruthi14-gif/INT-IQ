import { BriefcaseIcon, FileTextIcon, GraduationCapIcon, UserRoundIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrCreateProfile } from "@/lib/profiles"
import { requireUser } from "@/lib/session"

export const metadata: Metadata = { title: "Profile" }

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Suspense fallback={<><Skeleton className="h-10 w-52" /><Skeleton className="h-72 rounded-2xl" /></>}>
        <Profile />
      </Suspense>
    </div>
  )
}

async function Profile() {
  const user = await requireUser()
  const profile = await getOrCreateProfile(user.id)
  const name = user.name?.trim() || user.email.split("@")[0]
  const student = profile.role === "student"

  return (
    <>
      <div>
        <h1 className="text-3xl font-medium">Your profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your account and workspace.</p>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="flex items-center gap-2 font-medium"><UserRoundIcon className="size-4 text-brand-text" /> Account</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Name</dt><dd className="mt-1 font-medium">{name}</dd></div>
          <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 font-medium">{user.email}</dd></div>
        </dl>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-medium">{student ? <GraduationCapIcon className="size-4 text-brand-text" /> : <BriefcaseIcon className="size-4 text-brand-text" />} {student ? "Student workspace" : "Recruiter workspace"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{student ? "Practice interviews, manage your resume, and track applications." : "Post jobs, review candidates, and run interviews."}</p>
          </div>
        </div>
        {student && (
          <dl className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Target role</dt><dd className="mt-1 font-medium">{profile.targetRole ?? "Not set"}</dd></div>
            <div><dt className="text-muted-foreground">Experience</dt><dd className="mt-1 font-medium">{profile.experienceLevel ?? "Not set"}</dd></div>
            <div><dt className="text-muted-foreground">Resume</dt><dd className="mt-1 font-medium">{profile.resumeText ? (profile.resumeFileName ?? "Added") : "Not added"}</dd></div>
          </dl>
        )}
      </section>

      {student && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-6">
          <div><h2 className="flex items-center gap-2 font-medium"><FileTextIcon className="size-4 text-brand-text" /> Interview profile</h2><p className="mt-1 text-sm text-muted-foreground">Update your role, experience, job description, or resume analysis.</p></div>
          <Button asChild><Link href="/resume">Edit interview profile</Link></Button>
        </section>
      )}
    </>
  )
}
