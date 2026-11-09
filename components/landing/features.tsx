import {
  FileTextIcon,
  MessageSquareQuoteIcon,
  MicIcon,
  RouteIcon,
  ScanFaceIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MicIcon,
    title: "Live voice interviews",
    body: "Talk naturally. The interviewer listens, responds, and lets you interrupt, just like a real conversation.",
  },
  {
    icon: FileTextIcon,
    title: "Built from your resume",
    body: "Upload your resume and target role. Questions come from your own projects and the job you want.",
  },
  {
    icon: MessageSquareQuoteIcon,
    title: "Feedback on every answer",
    body: "Scores for clarity, structure and depth, plus a stronger sample answer you can learn from.",
  },
  {
    icon: TrendingUpIcon,
    title: "See yourself improve",
    body: "Every session is saved, so you can track your scores over time and spot weak topics early.",
  },
  {
    icon: ScanFaceIcon,
    title: "Real exam conditions",
    body: "Optional camera checks flag looking away or leaving the frame, so practice feels like the real thing.",
  },
  {
    icon: RouteIcon,
    title: "A plan for what's next",
    body: "A skill-gap breakdown and study plan focused on the topics that will move your score most.",
  },
]

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-text">Features</p>
          <h2 id="features-title" className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything you need to practice{" "}
            <span className="font-display font-normal italic">like it&rsquo;s the real one.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group bg-card p-6 transition-colors hover:bg-accent/40 sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl border bg-brand-soft text-brand-text transition-transform group-hover:-translate-y-0.5">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
