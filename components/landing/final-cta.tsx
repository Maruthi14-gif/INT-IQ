import Link from "next/link"
import { Button } from "@/components/ui/button"

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between md:py-24">
        <div className="max-w-xl">
          <h2 id="cta-title" className="text-3xl font-medium text-balance sm:text-4xl">
            Rehearse your next interview tonight
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Add your resume, pick a round and start talking. The report is ready the moment you finish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Button asChild className="h-11 px-5 text-[15px]">
            <Link href="/sign-in">Start practicing</Link>
          </Button>
          <Link href="/sign-in" className="text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            I&rsquo;m hiring
          </Link>
        </div>
      </div>
    </section>
  )
}
