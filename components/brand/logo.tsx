import { cn } from "@/lib/utils"

/** INT-IQ mark: three voice bars in ink on a flat highlighter-amber square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground", className)}>
      <svg viewBox="0 0 16 16" className="size-[58%]" fill="currentColor">
        <rect x="2" y="6" width="2.4" height="4" rx="1.2" />
        <rect x="6.8" y="2.5" width="2.4" height="11" rx="1.2" />
        <rect x="11.6" y="5" width="2.4" height="6" rx="1.2" />
      </svg>
    </span>
  )
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-base font-medium">INT-IQ</span>
    </span>
  )
}
