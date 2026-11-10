import {
  BriefcaseIcon,
  FileTextIcon,
  MessageSquareQuoteIcon,
  MicIcon,
  ScanFaceIcon,
  SendIcon,
  UserCheckIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

type Feature = { icon: LucideIcon; title: string; body: string }

const CANDIDATES: Feature[] = [
  {
    icon: MicIcon,
    title: "Voice interviews from your resume",
    body: "Talk to the interviewer like a phone call. Questions come from your own projects and target role.",
  },
  {
    icon: MessageSquareQuoteIcon,
    title: "Follow-ups on what you said",
    body: "Each next question picks up a detail from your last answer, the way a real interviewer probes.",
  },
  {
    icon: FileTextIcon,
    title: "A report on every answer",
    body: "Scores for clarity, structure, depth, relevance and confidence, plus a stronger version of each answer.",
  },
  {
    icon: ScanFaceIcon,
    title: "Presence checks, not judgments",
    body: "The camera checks you stay in view and on the screen. Video never leaves your device.",
  },
]

const RECRUITERS: Feature[] = [
  {
    icon: BriefcaseIcon,
    title: "Post jobs, collect applicants",
    body: "Candidates apply with their resume and target role already analyzed.",
  },
  {
    icon: SendIcon,
    title: "Invite to an AI interview",
    body: "Pick the round and length. When they finish you get the full report and the integrity check.",
  },
  {
    icon: VideoIcon,
    title: "Live interviews with a copilot",
    body: "Talk in the browser while the copilot suggests follow-ups and drafts the evaluation.",
  },
  {
    icon: UserCheckIcon,
    title: "You make the call",
    body: "Shortlist, reject or hire yourself. The AI drafts and suggests; it never decides.",
  },
]

export function Features() {
  return (
    <section aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <h2 id="features-title" className="max-w-2xl text-3xl font-medium text-balance sm:text-4xl">
          One interviewer for both sides of the table
        </h2>
        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          <Column id="candidates" title="For candidates" items={CANDIDATES} />
          <Column id="recruiters" title="For recruiters" items={RECRUITERS} />
        </div>
      </div>
    </section>
  )
}

function Column({ id, title, items }: { id: string; title: string; items: Feature[] }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h3 className="border-b pb-3 text-sm text-muted-foreground">{title}</h3>
      <ul className="mt-2 divide-y">
        {items.map(({ icon: Icon, title: t, body }) => (
          <li key={t} className="flex gap-4 py-5">
            <Icon className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <div>
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
