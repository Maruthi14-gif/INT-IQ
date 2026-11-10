import {
  BriefcaseIcon,
  CalendarCheckIcon,
  ChartLineIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MicIcon,
  SearchIcon,
  TargetIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react"
import type { UserRole } from "@/lib/db/schema"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Not built yet: shown with a "Soon" badge and not clickable. */
  soon?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

const STUDENT_NAV: NavGroup[] = [
  {
    label: "Practice",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Mock interview", href: "/interview", icon: MicIcon },
      { title: "Resume", href: "/resume", icon: FileTextIcon },
      { title: "Reports", href: "/reports", icon: ChartLineIcon },
    ],
  },
  {
    label: "Jobs",
    items: [
      { title: "Find jobs", href: "/jobs", icon: SearchIcon },
      { title: "My applications", href: "/applications", icon: BriefcaseIcon },
    ],
  },
  {
    label: "Prep tools",
    items: [
      { title: "CV tailor", href: "/prep/cv-tailor", icon: WandSparklesIcon, soon: true },
      { title: "Skill gap", href: "/prep/skill-gap", icon: TargetIcon, soon: true },
      { title: "Study plan", href: "/prep/study-plan", icon: CalendarCheckIcon, soon: true },
    ],
  },
]

const RECRUITER_NAV: NavGroup[] = [
  {
    label: "Hiring",
    items: [
      { title: "Dashboard", href: "/recruiter", icon: LayoutDashboardIcon },
      { title: "Jobs", href: "/recruiter/jobs", icon: BriefcaseIcon },
    ],
  },
]

export function navFor(role: UserRole): NavGroup[] {
  return role === "recruiter" ? RECRUITER_NAV : STUDENT_NAV
}

/** Kept for existing imports. */
export const NAV_GROUPS = STUDENT_NAV

export function titleForPath(pathname: string) {
  // Longest matching href wins, so /recruiter/jobs shows "Jobs", not "Dashboard".
  let best: NavItem | null = null
  for (const group of [...STUDENT_NAV, ...RECRUITER_NAV]) {
    for (const item of group.items) {
      const match = pathname === item.href || pathname.startsWith(item.href + "/")
      if (match && (!best || item.href.length > best.href.length)) best = item
    }
  }
  // Pages reached from the account menu rather than the sidebar.
  return best?.title ?? (pathname === "/profile" ? "Profile" : "")
}
