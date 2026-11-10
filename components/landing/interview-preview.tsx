import { ShieldCheckIcon } from "lucide-react"

const SCORES = [
  { label: "Clarity", value: 8 },
  { label: "Structure", value: 7 },
  { label: "Depth", value: 8 },
  { label: "Relevance", value: 9 },
]

/**
 * Static preview of a real INT-IQ moment: the candidate's answer, the follow-up that picks
 * up a detail from it (marked with the highlighter), and the report it ends in.
 */
export function InterviewPreview() {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_8px_24px_rgb(0_0_0/0.06)] dark:shadow-none">
      <figcaption className="flex items-center gap-3 border-b px-5 py-3 text-sm">
        <span className="shrink-0 font-medium">Technical round</span>
        <span className="hidden truncate text-muted-foreground sm:inline">Backend Developer Intern</span>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums">Q3 of 5 · 08:12</span>
      </figcaption>

      <div className="grid md:grid-cols-[minmax(0,1fr)_200px]">
        {/* the exchange */}
        <div className="space-y-5 p-5 sm:p-6">
          <Turn who="Interviewer">Tell me about a slow query you fixed.</Turn>
          <Turn who="Ananya" answer>
            On my inventory API the stock report took nine seconds. I ran EXPLAIN, saw a sequential scan, and added a{" "}
            <mark className="highlight bg-transparent text-foreground">composite index on warehouse and date</mark>. It
            dropped to 400 milliseconds.
          </Turn>
          <Turn who="Interviewer" next>
            Why that column order for the composite index, and what would break if you flipped it?
          </Turn>
        </div>

        {/* the report it ends in */}
        <aside className="border-t bg-muted/40 p-5 md:border-t-0 md:border-l" aria-label="Report preview">
          <p className="text-sm text-muted-foreground">Report</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-medium tabular-nums">78</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </p>
          <p className="mt-1 text-sm">Almost interview-ready</p>
          <ul className="mt-5 space-y-3">
            {SCORES.map((s) => (
              <li key={s.label}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono tabular-nums">{s.value}/10</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-foreground/60" style={{ width: `${s.value * 10}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-success" />
            Integrity check: no concerns
          </p>
        </aside>
      </div>
    </figure>
  )
}

function Turn({ who, children, answer, next }: { who: string; children: React.ReactNode; answer?: boolean; next?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {who}
        {next && <span className="ml-2 text-brand-text">follow-up</span>}
      </p>
      <p className={answer ? "mt-1 text-[15px] leading-7 text-muted-foreground" : "mt-1 text-[15px] leading-7"}>{children}</p>
    </div>
  )
}
