import {
  CalendarCheckIcon,
  ChartLineIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MicIcon,
  TargetIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Not built yet: shown with a "Soon" badge and not clickable. */
  soon?: boolean
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Practice",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Mock interview", href: "/interview", icon: MicIcon, soon: true },
      { title: "Resume", href: "/resume", icon: FileTextIcon, soon: true },
      { title: "Reports", href: "/reports", icon: ChartLineIcon, soon: true },
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

export function titleForPath(pathname: string) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) return item.title
    }
  }
  return ""
}
