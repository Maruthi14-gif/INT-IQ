import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { scoreTone } from "@/components/report/score-ring"
import type { InterviewSummary } from "@/lib/interviews"
import { cn } from "@/lib/utils"

const ROUND_LABEL = { technical: "Technical", behavioral: "Behavioral", hr: "HR" } as const

/** Rows linking to each report (or back into an unfinished interview). */
export function InterviewList({ items }: { items: InterviewSummary[] }) {
  return (
    <ul className="divide-y">
      {items.map((i) => {
        const done = i.status === "completed"
        return (
          <li key={i.id}>
            <Link
              href={done ? `/reports/${i.id}` : `/interview/${i.id}`}
              className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/40"
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl bg-muted font-mono text-sm font-medium tabular-nums",
                  done && i.overallScore !== null ? scoreTone(i.overallScore) : "text-muted-foreground",
                )}
              >
                {done && i.overallScore !== null ? i.overallScore : "–"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {ROUND_LABEL[i.type]} · {i.targetRole}
                  {i.mode === "voice" && <span className="ml-2 text-xs font-normal text-muted-foreground">Voice call</span>}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {i.startedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                  {done ? `${i.totalQuestions} questions` : "In progress, tap to continue"}
                </span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
