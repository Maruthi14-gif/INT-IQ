import { cn } from "@/lib/utils"

/** INT-IQ mark: a voice waveform inside an indigo tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-[9px] bg-linear-to-br from-indigo-400 to-indigo-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_2px_rgb(0_0_0/0.2)]",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-[58%] text-white" fill="currentColor">
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
      <span className="text-[15px] font-semibold tracking-tight">
        INT<span className="text-brand-text">-</span>IQ
      </span>
    </span>
  )
}
