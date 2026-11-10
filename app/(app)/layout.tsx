import { Suspense } from "react"
import { NavUserSkeleton } from "@/components/app/nav-user"
import { RoleSidebar, RoleSidebarFallback } from "@/components/app/role-sidebar"
import { SidebarUser } from "@/components/app/sidebar-user"
import { TopbarTitle } from "@/components/app/topbar-title"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = (
    <Suspense fallback={<NavUserSkeleton />}>
      <SidebarUser />
    </Suspense>
  )
  return (
    <SidebarProvider>
      {/* The menu depends on the user's role (request data), so it streams in. */}
      <Suspense fallback={<RoleSidebarFallback user={user} />}>
        <RoleSidebar user={user} />
      </Suspense>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Suspense fallback={null}>
            <TopbarTitle />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
