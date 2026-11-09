"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { LogoMark } from "@/components/brand/logo"
import { NAV_GROUPS } from "@/components/app/nav-items"
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

export function AppSidebar({ user }: { user: ReactNode }) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  // Tooltips only help on the collapsed desktop rail. On phones they add hidden layers
  // that swallow the first Escape press, so the sheet wouldn't close.
  const tip = (label: string) => (isMobile ? undefined : label)

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={tip("INT-IQ")}>
              <Link href="/dashboard">
                <LogoMark className="size-8 rounded-[10px]" />
                <span className="grid leading-tight">
                  <span className="text-[15px] font-semibold tracking-tight">
                    INT<span className="text-brand-text">-</span>IQ
                  </span>
                  <span className="text-xs text-muted-foreground">Interview practice</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <SidebarMenuItem key={item.href}>
                      {item.soon ? (
                        <>
                          <SidebarMenuButton aria-disabled tooltip={tip(`${item.title} (coming soon)`)} className="opacity-60">
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge className="rounded-md border px-1.5 text-[10px] font-medium text-muted-foreground">
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
      </SidebarContent>

      <SidebarFooter>{user}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
