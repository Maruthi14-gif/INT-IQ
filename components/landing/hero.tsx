import Link from "next/link"
import { InterviewPreview } from "@/components/landing/interview-preview"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 id="hero-title" className="font-display text-5xl leading-[1.04] text-balance sm:text-6xl">
            Interviews that follow up on what you actually said
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
            INT-IQ is an AI interviewer for students and the recruiters hiring them. It reads the resume, asks follow-up
            questions out loud, grades every answer and writes the report.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild className="h-11 px-5 text-[15px]">
              <Link href="/sign-in">Start practicing</Link>
            </Button>
            <Link href="/sign-in" className="text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              I&rsquo;m hiring
            </Link>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:60ms] [animation-fill-mode:both]">
          <InterviewPreview />
        </div>
      </div>
    </section>
  )
}
