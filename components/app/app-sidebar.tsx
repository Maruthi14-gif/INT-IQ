"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, type ReactNode } from "react"
import { LogoMark } from "@/components/brand/logo"
import { navFor, type NavGroup } from "@/components/app/nav-items"
import type { UserRole } from "@/lib/db/schema"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({
  user,
  role = "student",
  admin,
}: {
  user: ReactNode
  role?: UserRole
  /** Present only for admins: how many recruiters are waiting for review. */
  admin?: { pending: number }
}) {
  const { isMobile } = useSidebar()
  const nav = navFor(role, Boolean(admin))
  const badges: Record<string, number> = admin ? { "/admin/recruiters": admin.pending } : {}
  const recruiter = role === "recruiter"
  const home = recruiter ? "/recruiter" : "/dashboard"
  const subtitle = recruiter ? "Hiring" : "Interview practice"
  // Tooltips only help on the collapsed desktop rail. On phones they add hidden layers
  // that swallow the first Escape press, so the sheet wouldn't close.
  const tip = (label: string) => (isMobile ? undefined : label)

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={tip("INT-IQ")}>
              <Link href={home}>
                <LogoMark className="size-8 rounded-[10px]" />
                <span className="grid leading-tight">
                  <span className="text-[15px] font-medium">
                    INT-IQ
                  </span>
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* The current URL is request data: read it inside Suspense, show the menu without a highlight meanwhile. */}
        <Suspense fallback={<NavGroups groups={nav} pathname={null} tip={tip} badges={badges} />}>
          <NavGroupsWithPath groups={nav} tip={tip} badges={badges} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>{user}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

type Tip = (label: string) => string | undefined

type Badges = Record<string, number>

function NavGroupsWithPath({ groups, tip, badges }: { groups: NavGroup[]; tip: Tip; badges: Badges }) {
  return <NavGroups groups={groups} pathname={usePathname()} tip={tip} badges={badges} />
}

function NavGroups({ groups, pathname, tip, badges }: { groups: NavGroup[]; pathname: string | null; tip: Tip; badges: Badges }) {
  return (
    <>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname !== null && (pathname === item.href || (pathname.startsWith(item.href + "/") && !group.items.some((o) => o !== item && pathname.startsWith(o.href))))
                  return (
                    <SidebarMenuItem key={item.href}>
                      {item.soon ? (
                        <>
                          <SidebarMenuButton aria-disabled tooltip={tip(`${item.title} (coming soon)`)} className="opacity-60">
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge className="rounded-md border px-1.5 text-[11px] font-medium text-muted-foreground">
                            Soon
                          </SidebarMenuBadge>
                        </>
                      ) : (
                        <>
                          <SidebarMenuButton asChild isActive={active} tooltip={tip(item.title)}>
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                          {(badges[item.href] ?? 0) > 0 && (
                            <SidebarMenuBadge
                              className="rounded-full bg-brand px-1.5 font-mono text-[11px] text-brand-foreground tabular-nums"
                              aria-label={`${badges[item.href]} waiting`}
                            >
                              {badges[item.href]}
                            </SidebarMenuBadge>
                          )}
                        </>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
    </>
  )
}
