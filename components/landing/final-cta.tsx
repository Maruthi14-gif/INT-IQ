import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { VoiceOrb } from "@/components/brand/voice-orb"
import { Button } from "@/components/ui/button"

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#0d0c1d] px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(99_102_241/0.45),transparent_70%)]" />
          <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
          <VoiceOrb className="mx-auto size-20" />
          <h2 id="cta-title" className="mx-auto mt-8 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your next interview is <span className="font-display font-normal text-indigo-300 italic">closer than you think.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-white/70">
            Start a free practice round in under a minute. All you need is a microphone.
          </p>
          <Button asChild className="mt-8 h-11 bg-white px-5 text-[15px] text-[#0d0c1d] hover:bg-white/90">
            <Link href="/sign-in">
              Start practicing free
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
