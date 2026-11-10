import { Badge } from "@/components/ui/badge"
import type { ApplicationStatus, InvitationStatus, JobStatus } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interviewing: "Interviewing",
  shortlisted: "Shortlisted",
  rejected: "Not selected",
  hired: "Hired",
}

const APPLICATION_TONE: Record<ApplicationStatus, string> = {
  applied: "",
  reviewing: "",
  interviewing: "border-brand/30 bg-brand-soft text-brand-text",
  shortlisted: "border-success/30 bg-success/10 text-success",
  rejected: "text-muted-foreground",
  hired: "border-success/30 bg-success/10 text-success",
}

export function ApplicationStatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(APPLICATION_TONE[status], className)} data-status={status}>
      {APPLICATION_LABEL[status]}
    </Badge>
  )
}

export const JOB_LABEL: Record<JobStatus, string> = { draft: "Draft", open: "Open", closed: "Closed" }

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(status === "open" && "border-success/30 bg-success/10 text-success", status === "closed" && "text-muted-foreground", className)}
      data-status={status}
    >
      {JOB_LABEL[status]}
    </Badge>
  )
}

export const INVITATION_LABEL: Record<InvitationStatus, string> = {
  pending: "Invited",
  accepted: "In progress",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
}

export function InvitationStatusBadge({ status, className }: { status: InvitationStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(status === "completed" && "border-success/30 bg-success/10 text-success", status === "pending" && "border-warning/30 bg-warning/10 text-warning", className)}
    >
      {INVITATION_LABEL[status]}
    </Badge>
  )
}

export const LEVEL_LABEL = { fresher: "Fresher", junior: "0–2 years", mid: "2–5 years" } as const
