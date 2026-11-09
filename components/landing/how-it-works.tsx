const STEPS = [
  {
    title: "Add your resume and target role",
    body: "Upload a PDF, paste the job description, and pick a Technical, Behavioral or HR round.",
  },
  {
    title: "Talk to your AI interviewer",
    body: "A focused voice interview with follow-up questions that build on what you actually said.",
  },
  {
    title: "Get your report",
    body: "Scores, a full transcript, and specific fixes for every answer, plus what to practice next.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-text">How it works</p>
          <h2 id="how-title" className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            From resume to report in <span className="font-display font-normal italic">three steps.</span>
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6 sm:p-7">
              <span className="font-display text-5xl leading-none text-brand-text italic">{i + 1}</span>
              <h3 className="mt-6 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
