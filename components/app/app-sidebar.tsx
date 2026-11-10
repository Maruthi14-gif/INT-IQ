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

export function AppSidebar({ user, role = "student" }: { user: ReactNode; role?: UserRole }) {
  const { isMobile } = useSidebar()
  const nav = navFor(role)
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
        <Suspense fallback={<NavGroups groups={nav} pathname={null} tip={tip} />}>
          <NavGroupsWithPath groups={nav} tip={tip} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>{user}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

type Tip = (label: string) => string | undefined

function NavGroupsWithPath({ groups, tip }: { groups: NavGroup[]; tip: Tip }) {
  return <NavGroups groups={groups} pathname={usePathname()} tip={tip} />
}

function NavGroups({ groups, pathname, tip }: { groups: NavGroup[]; pathname: string | null; tip: Tip }) {
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
                        <SidebarMenuButton asChild isActive={active} tooltip={tip(item.title)}>
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
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
