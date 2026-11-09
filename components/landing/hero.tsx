import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { InterviewPreview } from "@/components/landing/interview-preview"
import { Button } from "@/components/ui/button"

const ROUNDS = ["Technical", "Behavioral", "HR"]

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)]" />
      <div className="absolute inset-0 -z-10 bg-glow" />

      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex animate-in items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur fade-in slide-in-from-bottom-2 duration-500">
            <span className="size-1.5 rounded-full bg-brand" />
            AI mock interviews for students
          </span>

          <h1 id="hero-title" className="mt-6 animate-in text-4xl font-semibold tracking-tight text-balance fade-in slide-in-from-bottom-3 duration-700 sm:text-6xl md:text-7xl">
            Walk into every interview{" "}
            <span className="font-display font-normal text-brand-text italic">already prepared.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl animate-in text-base leading-relaxed text-pretty text-muted-foreground fade-in slide-in-from-bottom-4 duration-700 sm:text-lg">
            Practice out loud with an AI interviewer that reads your resume, asks real follow-up questions, and
            tells you exactly what to fix before the real thing.
          </p>

          <div className="mt-8 flex animate-in flex-col items-center justify-center gap-3 fade-in slide-in-from-bottom-4 duration-1000 sm:flex-row">
            <Button asChild className="h-11 w-full px-5 text-[15px] shadow-lg shadow-indigo-500/25 sm:w-auto">
              <Link href="/sign-in">
                Start practicing free
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full px-5 text-[15px] sm:w-auto">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Practice {ROUNDS.slice(0, -1).join(", ")} and {ROUNDS.at(-1)} rounds
          </p>
        </div>

        <div className="mt-14 animate-in fade-in slide-in-from-bottom-8 duration-1000 sm:mt-20">
          <InterviewPreview />
        </div>
      </div>
    </section>
  )
}
