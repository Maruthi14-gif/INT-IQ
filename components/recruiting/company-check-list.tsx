import { CheckCircle2Icon, CircleHelpIcon, XCircleIcon } from "lucide-react"
import type { Assessment, CheckVerdict } from "@/lib/recruiter-assessment"
import { VERDICT_LABEL } from "@/lib/recruiter-assessment"
import { cn } from "@/lib/utils"

/** The verdict as a small pill. */
export function VerdictBadge({ verdict }: { verdict: CheckVerdict }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        verdict === "strong" && "border-success/30 bg-success/10 text-success",
        verdict === "partial" && "border-brand/40 bg-brand-soft text-brand-text",
        verdict === "weak" && "border-warning/30 bg-warning/10 text-warning",
        verdict === "not-found" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
      data-testid="company-verdict"
    >
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

/** What INT-IQ checked about the company and the recruiter, one line per check. */
export function CompanyCheckList({ assessment, className }: { assessment: Assessment; className?: string }) {
  return (
    <ul className={cn("space-y-1.5 text-sm", className)} aria-label="Company checks">
      {assessment.lines.map((line) => (
        <li key={line.text} className="flex items-start gap-2">
          {line.ok === true ? (
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-label="Passed" />
          ) : line.ok === false ? (
            <XCircleIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Didn't pass" />
          ) : (
            <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Unknown" />
          )}
          <span className={cn(line.ok === null && "text-muted-foreground")}>{line.text}</span>
        </li>
      ))}
    </ul>
  )
}
