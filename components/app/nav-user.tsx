"use client"

import { ChevronsUpDownIcon, Loader2Icon, LogOutIcon, Repeat2Icon, UserIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient } from "@/lib/auth/client"
import { runAuth } from "@/lib/auth/errors"
import type { UserRole } from "@/lib/db/schema"

type NavUserProps = { user: { name: string; email: string; image?: string | null }; role?: UserRole }

function displayName(user: NavUserProps["user"]) {
  return user.name?.trim() || user.email.split("@")[0]
}

function initials(name: string) {
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function UserAvatar({ user }: NavUserProps) {
  return (
    <Avatar className="size-8 rounded-lg after:rounded-lg">
      <AvatarImage src={user.image ?? undefined} alt="" referrerPolicy="no-referrer" className="rounded-lg" />
      <AvatarFallback className="rounded-lg bg-brand-soft text-xs font-medium text-brand-text">
        {initials(displayName(user))}
      </AvatarFallback>
    </Avatar>
  )
}

export function NavUser({ user, role }: NavUserProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [signingOut, setSigningOut] = useState(false)
  const name = displayName(user)

  async function signOut() {
    setSigningOut(true)
    const result = await runAuth(() => authClient.signOut())
    if (!result.ok) {
      setSigningOut(false)
      toast.error("Couldn't sign out. Please try again.")
      return
    }
    router.replace("/sign-in")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <UserAvatar user={user} />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
            className="min-w-60 rounded-xl"
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-2 font-normal">
              <UserAvatar user={user} />
              <span className="grid min-w-0 text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role && (
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                {role === "recruiter" ? "Recruiter account" : "Student account"}
              </DropdownMenuLabel>
            )}
            <DropdownMenuItem asChild>
              <Link href="/profile"><UserIcon />Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/welcome"><Repeat2Icon />Switch workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                signOut()
              }}
              disabled={signingOut}
            >
              {signingOut ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function NavUserSkeleton() {
  // Fixed widths: random values aren't allowed during prerendering.
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:p-0">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
